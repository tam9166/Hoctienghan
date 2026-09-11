/* Real-browser P50 QA: node tests/p50-product-polish-responsive.browser.js [url] */
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const edge = [path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')].find((candidate) => candidate && fs.existsSync(candidate));
if (!edge) throw new Error('Microsoft Edge is required for responsive browser QA.');
const baseUrl = process.argv[2] || 'http://127.0.0.1:4173/';
const port = 10410 + Math.floor(Math.random() * 70);
const profile = path.join(os.tmpdir(), `klearn-p50-browser-${process.pid}`);
const browser = childProcess.spawn(edge, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--disable-gpu', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore', windowsHide: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function json(url, options) { const response = await fetch(url, options); if (!response.ok) throw new Error(`${response.status} ${url}`); return response.json(); }
async function connect(url) { const socket = new WebSocket(url); let id = 0; const pending = new Map(); await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; }); socket.onmessage = (event) => { const message = JSON.parse(event.data); const request = pending.get(message.id); if (!request) return; pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); }; return { send(method, params = {}) { return new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })); }); }, close() { socket.close(); } }; }
async function evaluate(cdp, expression) { const output = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (output.exceptionDetails) throw new Error(output.exceptionDetails.exception?.description || output.exceptionDetails.text); return output.result.value; }
async function until(cdp, expression, attempts = 100) { for (let attempt = 0; attempt < attempts; attempt += 1) { if (await evaluate(cdp, expression)) return true; await wait(100); } return false; }

(async () => {
  let cdp;
  try {
    let version;
    for (let attempt = 0; attempt < 50 && !version; attempt += 1) { try { version = await json(`http://127.0.0.1:${port}/json/version`); } catch (_) { await wait(100); } }
    if (!version) throw new Error('Could not start Edge.');
    const target = await json(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`, { method: 'PUT' });
    cdp = await connect(target.webSocketDebuggerUrl);
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    assert.equal(await until(cdp, `location.origin !== 'null' && document.readyState === 'complete'`), true, 'page did not load');

    const timestamp = new Date().toISOString();
    const user = { id: 'p50-qa', fullName: 'Minh Anh', email: 'p50@local.test', level: 'Beginner', learningTrack: 'topik', learningMode: 'topik', goals: ['topik'], studyMinutesPerDay: 15, currentTopikLevel: 1, targetTopikLevel: 2, onboardingCompleted: true, createdAt: timestamp };
    await evaluate(cdp, `(() => { localStorage.setItem('klearn_users', ${JSON.stringify(JSON.stringify([user]))}); localStorage.setItem('klearn_session', ${JSON.stringify(JSON.stringify({ userId: user.id, createdAt: timestamp }))}); localStorage.setItem('klearn_progress', ${JSON.stringify(JSON.stringify({ [user.id]: { skills: {}, stats: { streak: 4, lessonsCompleted: 2 }, lessonProgress: {}, daily: { date: timestamp.slice(0,10), tasks: {} }, p50Marker: 'keep-me' } }))}); localStorage.setItem('klearn_settings', ${JSON.stringify(JSON.stringify({ users: { [user.id]: { theme: 'light', language: 'vi' } } }))}); location.hash='home'; location.reload(); })()`);
    assert.equal(await until(cdp, `Boolean(window.ProductLanguageService && document.querySelector('.ux-home'))`), true, 'polished Home did not render');
    assert.equal(await evaluate(cdp, `getComputedStyle(document.documentElement).getPropertyValue('--primary').trim().toUpperCase() === '#DDFF66'`), true, 'brand token not applied');
    assert.equal(await evaluate(cdp, `document.querySelector('.ux-primary-action small')?.textContent.trim() === 'Đề xuất hôm nay'`), true, 'recommendation copy is still technical');
    assert.equal(await evaluate(cdp, `!document.querySelector('.ux-recommended > header > span')`), true, 'internal disclosure tier is visible');
    assert.equal(await evaluate(cdp, `document.querySelector('#aiFab')?.textContent.includes('AI')`), false, 'AI badge still dominates the primary UI');

    const results = [];
    for (const width of [360, 390, 430, 768, 1024, 1440, 1920]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 1050, deviceScaleFactor: 1, mobile: width <= 430 }); await wait(130);
      const snapshot = await evaluate(cdp, `(() => ({ width: innerWidth, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, appRight: document.getElementById('app').getBoundingClientRect().right, visibleNav: [...document.querySelectorAll('.bottom-nav .nav-item')].filter((node) => getComputedStyle(node).display !== 'none').length, sidebarWidth: document.getElementById('bottomNav').getBoundingClientRect().width }))()`);
      assert.ok(snapshot.overflow <= 1, `${width}px has horizontal overflow: ${snapshot.overflow}`);
      assert.ok(snapshot.appRight <= width + 1, `${width}px app exceeds viewport`);
      assert.equal(snapshot.visibleNav, width < 1024 ? 5 : 6, `${width}px navigation count is not simplified correctly`);
      if (width >= 1024) assert.ok(snapshot.sidebarWidth >= 240 && snapshot.sidebarWidth <= 280, `${width}px sidebar width is invalid`);
      results.push(snapshot);
    }

    await evaluate(cdp, `document.getElementById('aiFab').click()`); await wait(80);
    assert.equal(await evaluate(cdp, `Boolean(document.querySelector('.ai-panel')) && document.querySelector('.ai-panel strong').textContent === 'Trợ lý học tập'`), true, 'learning assistant panel copy is incorrect');
    assert.equal(await evaluate(cdp, `document.querySelector('.ai-panel').getBoundingClientRect().right <= innerWidth + 1`), true, 'learning help panel overflows');
    await evaluate(cdp, `document.documentElement.dataset.theme='dark'`); await wait(50);
    assert.equal(await evaluate(cdp, `getComputedStyle(document.body).color !== getComputedStyle(document.body).backgroundColor`), true, 'dark mode text contrast collapsed');
    await evaluate(cdp, `(() => { const sample=document.createElement('p'); sample.id='p50-copy'; sample.textContent='P50 · AI Coach · CloudSync · backend · database'; document.getElementById('app').append(sample); ProductLanguageService.apply(document); })()`);
    assert.equal(await evaluate(cdp, `document.getElementById('p50-copy').textContent`), 'Trợ lý học tập · đồng bộ dữ liệu · hệ thống · kho dữ liệu', 'technical copy was not normalized');
    assert.equal(await evaluate(cdp, `JSON.parse(localStorage.getItem('klearn_progress'))['p50-qa'].p50Marker`), 'keep-me', 'existing progress was changed');
    const personas = await evaluate(cdp, `(() => { const user=KLEARN_APP.state.currentUser; const cases=[{name:'beginner',value:{learningTrack:'foundation',level:'Level 0',learningMode:'casual',goals:['hobby']}},{name:'topik',value:{learningTrack:'topik',level:'TOPIK I',learningMode:'topik',goals:['topik']}},{name:'conversation',value:{learningTrack:'topik',level:'Beginner',learningMode:'conversation',goals:['living']}}]; return cases.map((item)=>{Object.assign(user,item.value); return {expected:item.name,actual:UserExperienceProfileService.segment(),features:FeaturePriorityService.recommended().length};}); })()`);
    personas.forEach((persona) => { assert.equal(persona.actual, persona.expected, `${persona.expected} persona was misclassified`); assert.ok(persona.features > 0, `${persona.expected} has no recommended learning action`); });
    console.log(JSON.stringify({ status: 'passed', widths: results.map((item) => item.width), themes: ['light', 'dark'], nav: '5 mobile / 6 desktop', personas: personas.map((item) => item.actual), progressPreserved: true }, null, 2));
  } finally {
    try { cdp?.close(); } catch (_) {}
    browser.kill();
    await wait(300);
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 120 }); } catch (_) { /* Edge may release its profile just after the test process exits. */ }
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
