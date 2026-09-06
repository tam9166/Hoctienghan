/* Real-browser P40 QA: node tests/future-language-platform-responsive.browser.js [url] */
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const edge = [path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')].find((candidate) => candidate && fs.existsSync(candidate));
if (!edge) throw new Error('Microsoft Edge is required for responsive browser QA.');
const baseUrl = process.argv[2] || 'http://127.0.0.1:4173/'; const port = 10760 + Math.floor(Math.random() * 70); const profile = path.join(os.tmpdir(), `klearn-p40-browser-${process.pid}`);
const browser = childProcess.spawn(edge, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--disable-gpu', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore', windowsHide: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function json(url, options) { const response = await fetch(url, options); if (!response.ok) throw new Error(`${response.status} ${url}`); return response.json(); }
async function connect(url) { const socket = new WebSocket(url); let id = 0; const pending = new Map(); await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; }); socket.onmessage = (event) => { const message = JSON.parse(event.data); const request = pending.get(message.id); if (!request) return; pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); }; return { send(method, params = {}) { return new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })); }); }, close() { socket.close(); } }; }
async function evaluate(cdp, expression) { const output = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (output.exceptionDetails) throw new Error(output.exceptionDetails.exception?.description || output.exceptionDetails.text); return output.result.value; }
async function until(cdp, expression, attempts = 100) { for (let attempt = 0; attempt < attempts; attempt += 1) { if (await evaluate(cdp, expression)) return true; await wait(100); } return false; }

(async () => {
  try {
    let version; for (let attempt = 0; attempt < 50 && !version; attempt += 1) { try { version = await json(`http://127.0.0.1:${port}/json/version`); } catch (_) { await wait(100); } } if (!version) throw new Error('Could not start Edge.');
    const target = await json(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`, { method: 'PUT' }); const cdp = await connect(target.webSocketDebuggerUrl); await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); assert.equal(await until(cdp, `location.origin !== 'null' && document.readyState === 'complete'`), true, 'page did not load');
    const timestamp = new Date().toISOString(); const user = { id: 'p40-qa', fullName: 'P40 Learner', email: 'p40@local.test', level: 'TOPIK 1', onboardingCompleted: true, createdAt: timestamp };
    await evaluate(cdp, `(() => { localStorage.setItem('klearn_users', ${JSON.stringify(JSON.stringify([user]))}); localStorage.setItem('klearn_session', ${JSON.stringify(JSON.stringify({ userId: user.id, createdAt: timestamp }))}); localStorage.setItem('klearn_progress', ${JSON.stringify(JSON.stringify({ [user.id]: { skills: {}, stats: { streak: 2 }, lessonProgress: {}, daily: { date: timestamp.slice(0,10), tasks: {} } } }))}); localStorage.setItem('klearn_settings', ${JSON.stringify(JSON.stringify({ users: { [user.id]: { theme: 'dark', language: 'vi' } } }))}); location.hash='future-language-platform'; location.reload(); })()`);
    assert.equal(await until(cdp, `Boolean(window.UniversalLanguageEngine && document.querySelector('.flp-launch-grid'))`), true, 'P40 Global Language Platform did not render');
    assert.equal(await evaluate(cdp, `window.UniversalLanguageEngine.languages().length`), 4);
    assert.equal(await evaluate(cdp, `window.UniversalLanguageEngine.active('ko')`), true);
    assert.equal(await evaluate(cdp, `window.UniversalLanguageEngine.active('ja')`), false, 'foundation language shown as launched');

    const results = [];
    for (const width of [360, 768, 1024, 1440, 1920]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 1080, deviceScaleFactor: 1, mobile: false }); await wait(100);
      const metrics = await evaluate(cdp, `(() => { const app=document.getElementById('app'),nav=document.getElementById('bottomNav'),grid=document.querySelector('.flp-launch-grid');const rect=(node)=>{const r=node?.getBoundingClientRect();return r?{left:r.left,width:r.width,right:r.right}:null};return{dark:document.documentElement.dataset.theme==='dark',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,bodyOverflow:document.body.scrollWidth>document.body.clientWidth,app:rect(app),nav:rect(nav),columns:grid?getComputedStyle(grid).gridTemplateColumns.split(' ').length:0,minTouch:Math.min(...[...document.querySelectorAll('.flp-launch-grid button')].map((node)=>node.getBoundingClientRect().height))};})()`);
      assert.equal(metrics.dark, true, `dark mode missing at ${width}px`); assert.equal(metrics.overflow, false, `html overflow at ${width}px`); assert.equal(metrics.bodyOverflow, false, `body overflow at ${width}px`); assert.ok(metrics.minTouch >= 44, `touch target too small at ${width}px`);
      if (width >= 1024) { assert.ok(metrics.nav.width >= 240 && metrics.nav.width <= 280, `sidebar invalid at ${width}px`); assert.ok(metrics.app.left >= 240, `content overlaps sidebar at ${width}px`); } else assert.ok(metrics.app.left < 2, `compact content offset at ${width}px`);
      assert.equal(metrics.columns, width <= 600 ? 1 : width <= 1100 ? 2 : 4, `future platform grid invalid at ${width}px`); results.push({ width, columns: metrics.columns, overflow: metrics.overflow, dark: metrics.dark });
    }

    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 1150, deviceScaleFactor: 1, mobile: false });
    await evaluate(cdp, `window.KLEARN_APP.setView('cross-language-lab')`); assert.equal(await until(cdp, `Boolean(document.getElementById('crossLanguageForm'))`), true, 'cross-language lab missing');
    await evaluate(cdp, `(() => { const f=document.getElementById('crossLanguageForm');f.sourceLanguage.value='vi';f.targetLanguage.value='ko';f.mode.value='compare';f.source.value='Tôi là sinh viên';f.target.value='저는 학생이에요';f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));})()`); await wait(80);
    const stored = await evaluate(cdp, `localStorage.getItem('klearn_future_language_platform') || ''`);
    assert.match(stored, /crossLanguageHistory/); assert.doesNotMatch(stored, /Tôi là sinh viên|저는 학생이에요/, 'raw comparison content persisted');
    await evaluate(cdp, `window.KLEARN_APP.setView('language-brain')`); assert.equal(await until(cdp, `document.querySelectorAll('[data-language-brain]').length===4`), true, 'language brain profiles missing');
    await evaluate(cdp, `(() => { const f=document.querySelector('[data-language-brain="ja"]');f.goal.value='JLPT N5';f.learningStyle.value='visual';f.currentLevel.value='Starter';f.targetLevel.value='N5';f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));})()`); await wait(80);
    assert.equal(await evaluate(cdp, `window.PersonalLanguageBrainService.snapshot().brain.ja.goal`), 'JLPT N5');
    await evaluate(cdp, `window.KLEARN_APP.setView('future-integrations')`); assert.equal(await until(cdp, `document.querySelectorAll('.flp-capability-grid article').length===4`), true, 'integration capabilities missing');
    assert.equal(await evaluate(cdp, `window.RealTimeTranslationAssistantService.capabilities().continuousBackgroundListening`), false);
    assert.equal(await evaluate(cdp, `window.WearableLanguageService.policy().forbiddenData.includes('health')`), true);
    await evaluate(cdp, `document.querySelector('[data-ar-language]').click()`); assert.equal(await until(cdp, `location.hash==='#korean-document-assistant'`), true, 'AR fallback did not open safe camera/text route');
    await evaluate(cdp, `window.KLEARN_APP.setView('global-course-marketplace')`); assert.equal(await until(cdp, `Boolean(document.querySelector('.flp-market-summary'))`), true, 'global marketplace missing');
    assert.equal(await evaluate(cdp, `window.GlobalCourseMarketplaceService.catalog().every(c=>c.verified===true&&c.status==='approved')`), true, 'unreviewed course leaked into marketplace');
    assert.equal(await evaluate(cdp, `document.documentElement.scrollWidth>document.documentElement.clientWidth`), false, 'P40 views overflow at 360px');
    console.log(JSON.stringify(results)); console.log('future language platform responsive: four-language status, cross-language privacy, personal brain, integration fallback, approved marketplace, dark mode and 360-1920 layout passed'); cdp.close();
  } finally { browser.kill(); await wait(200); if (path.resolve(profile).startsWith(path.resolve(os.tmpdir()))) fs.rmSync(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 }); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
