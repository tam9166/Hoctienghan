/* Real-browser P36 QA: node tests/advanced-voice-responsive.browser.js [url] */
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const edge = [path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')].find((candidate) => candidate && fs.existsSync(candidate));
if (!edge) throw new Error('Microsoft Edge is required for responsive browser QA.');
const baseUrl = process.argv[2] || 'http://127.0.0.1:4173/'; const port = 10500 + Math.floor(Math.random() * 70); const profile = path.join(os.tmpdir(), `klearn-p36-browser-${process.pid}`);
const browser = childProcess.spawn(edge, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--disable-gpu', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore', windowsHide: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function json(url, options) { const response = await fetch(url, options); if (!response.ok) throw new Error(`${response.status} ${url}`); return response.json(); }
async function connect(url) { const socket = new WebSocket(url); let id = 0; const pending = new Map(); await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; }); socket.onmessage = (event) => { const message = JSON.parse(event.data); const request = pending.get(message.id); if (!request) return; pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); }; return { send(method, params = {}) { return new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })); }); }, close() { socket.close(); } }; }
async function evaluate(cdp, expression) { const output = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (output.exceptionDetails) throw new Error(output.exceptionDetails.exception?.description || output.exceptionDetails.text); return output.result.value; }
async function until(cdp, expression, attempts = 100) { for (let attempt = 0; attempt < attempts; attempt += 1) { if (await evaluate(cdp, expression)) return true; await wait(100); } return false; }

(async () => {
  try {
    let version; for (let attempt = 0; attempt < 50 && !version; attempt += 1) { try { version = await json(`http://127.0.0.1:${port}/json/version`); } catch (_) { await wait(100); } } if (!version) throw new Error('Could not start Edge.');
    const target = await json(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`, { method: 'PUT' }); const cdp = await connect(target.webSocketDebuggerUrl); await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    assert.equal(await until(cdp, `document.readyState==='complete' && Boolean(window.KLEARN_ROUTE_LOADER)`), true, 'app did not load');
    await evaluate(cdp, `window.KLEARN_ROUTE_LOADER.loadGroup('voice')`);
    assert.equal(await until(cdp, `Boolean(window.AdvancedVoiceLearningService)`), true, 'voice module did not load');
    const timestamp = new Date().toISOString(); const user = { id: 'p36-qa', fullName: 'Voice QA', email: 'p36@local.test', level: 'TOPIK I', goals: ['conversation'], currentTopikLevel: 2, targetTopikLevel: 3, onboardingCompleted: true, createdAt: timestamp };
    await evaluate(cdp, `(() => { localStorage.setItem('klearn_users', ${JSON.stringify(JSON.stringify([user]))}); localStorage.setItem('klearn_session', ${JSON.stringify(JSON.stringify({ userId: user.id, createdAt: timestamp }))}); localStorage.setItem('klearn_progress', ${JSON.stringify(JSON.stringify({ [user.id]: { skills: { speaking: 20 }, stats: { streak: 1, lessonsCompleted: 0, learningDays: 1, wordsLearned: 0 }, lessonProgress: {}, daily: { date: timestamp.slice(0,10), tasks: {} }, pronunciationAttempts: [], writingSubmissions: [], mockTests: [] } }))}); localStorage.setItem('klearn_settings', ${JSON.stringify(JSON.stringify({ users: { [user.id]: { theme: 'dark', language: 'vi' } } }))}); location.hash='advanced-voice'; location.reload(); })()`);
    assert.equal(await until(cdp, `document.querySelectorAll('.voice-scenario-grid article').length===3`), true, 'voice scenarios did not render');

    for (const width of [360, 768, 1024, 1440, 1920]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 1100, deviceScaleFactor: 1, mobile: width < 768 }); await wait(90);
      const metrics = await evaluate(cdp, `(() => { const grid=document.querySelector('.voice-scenario-grid'); const buttons=[...document.querySelectorAll('.voice-scenario-grid button')]; return { htmlOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth, bodyOverflow:document.body.scrollWidth>document.body.clientWidth, dark:document.documentElement.dataset.theme==='dark', columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length, minTouch:Math.min(...buttons.map((item)=>item.getBoundingClientRect().height)) }; })()`);
      assert.equal(metrics.htmlOverflow, false, `html overflow at ${width}px`); assert.equal(metrics.bodyOverflow, false, `body overflow at ${width}px`); assert.equal(metrics.dark, true, `dark mode missing at ${width}px`); assert.ok(metrics.minTouch >= (width < 768 ? 48 : 44), `touch target too small at ${width}px`); assert.equal(metrics.columns, width <= 800 ? 1 : 3, `scenario layout invalid at ${width}px`);
    }

    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 1100, deviceScaleFactor: 1, mobile: true });
    await evaluate(cdp, `document.querySelector('[data-voice-scenario="daily-introduction"]').click()`); assert.equal(await until(cdp, `Boolean(document.getElementById('voiceFallbackForm'))`), true, 'voice session did not start');
    await evaluate(cdp, `(() => { const input=document.querySelector('#voiceFallbackForm input'); input.value='안녕하세요 저는 민수예요'; document.getElementById('voiceFallbackForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})); })()`);
    assert.equal(await until(cdp, `Boolean(document.querySelector('.voice-result'))`), true, 'voice feedback did not render');
    assert.ok(await evaluate(cdp, `document.querySelectorAll('.voice-phoneme-grid>div').length`), 'phoneme breakdown is empty');
    const persisted = await evaluate(cdp, `JSON.parse(localStorage.getItem('klearn_voice_learning')||'{}')['p36-qa'][0]`);
    assert.equal(persisted.recordType, 'attempt'); assert.equal(persisted.audioStored, false); assert.equal('audioBlob' in persisted, false); assert.ok(persisted.fluency >= 0 && persisted.fluency <= 100); assert.ok(persisted.confidence >= 0 && persisted.confidence <= 100);

    await evaluate(cdp, `window.KLEARN_APP.setView('voice-history')`); assert.equal(await until(cdp, `document.querySelectorAll('.voice-history article').length===1`), true, 'history did not survive view change');
    await evaluate(cdp, `window.KLEARN_APP.setView('voice-goals')`); await wait(80); await evaluate(cdp, `document.querySelector('[data-voice-goal="practice-10"]').click()`); assert.equal(await evaluate(cdp, `VoiceGoalService.active().id`), 'practice-10');
    await evaluate(cdp, `window.KLEARN_APP.setView('voice-report')`); assert.equal(await until(cdp, `Boolean(document.querySelector('.voice-report'))`), true, 'quality report did not render');
    assert.equal(await evaluate(cdp, `document.body.textContent.includes('không thay thế đánh giá')`), true, 'analysis disclosure missing');

    console.log('advanced voice responsive: 360, 768, 1024, 1440, 1920, dark mode, transcript feedback, phoneme UI, private history, goals and report passed'); cdp.close();
  } finally { browser.kill(); await wait(200); fs.rmSync(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 }); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
