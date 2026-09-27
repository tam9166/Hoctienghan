/* Real-browser P2 UX journeys: node tests/p2-ux-fixes-responsive.browser.js */
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = path.join(__dirname, '..');
const edge = [path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')].find((candidate) => candidate && fs.existsSync(candidate));
if (!edge) throw new Error('Microsoft Edge is required for UX P2 browser QA.');
const webPort = 17600 + Math.floor(Math.random() * 80); const debugPort = 17700 + Math.floor(Math.random() * 80); const baseUrl = `http://127.0.0.1:${webPort}/`; const profile = path.join(os.tmpdir(), `klearn-ux-p2-${process.pid}`);
const server = cp.spawn('python', ['-m', 'http.server', String(webPort), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore', windowsHide: true });
const browser = cp.spawn(edge, ['--headless=new', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, '--disable-gpu', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore', windowsHide: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function json(url, options) { const response = await fetch(url, options); if (!response.ok) throw new Error(`${response.status} ${url}`); return response.json(); }
async function connect(url) { const socket = new WebSocket(url); let id = 0; const pending = new Map(); await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; }); socket.onmessage = (event) => { const message = JSON.parse(event.data); const request = pending.get(message.id); if (!request) return; pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); }; return { send(method, params = {}) { return new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })); }); }, close() { socket.close(); } }; }
async function evaluate(cdp, expression) { const output = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (output.exceptionDetails) throw new Error(output.exceptionDetails.exception?.description || output.exceptionDetails.text); return output.result.value; }
async function until(cdp, expression, attempts = 120) { for (let index = 0; index < attempts; index += 1) { if (await evaluate(cdp, expression)) return true; await wait(80); } return false; }

(async () => {
  let cdp;
  try {
    let version; for (let attempt = 0; attempt < 80 && !version; attempt += 1) { try { version = await json(`http://127.0.0.1:${debugPort}/json/version`); } catch (_) { await wait(100); } }
    if (!version) throw new Error('Could not start Edge.');
    const target = await json(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(`${baseUrl}#welcome`)}`, { method: 'PUT' }); cdp = await connect(target.webSocketDebuggerUrl); await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    assert.equal(await until(cdp, `document.readyState==='complete'&&Boolean(window.KLEARN_APP)`), true);
    const user = { id: 'ux-p2-user', fullName: 'UX P2', email: 'ux-p2@local.test', level: 'Beginner', goals: ['topik'], currentTopikLevel: 1, targetTopikLevel: 3, onboardingCompleted: true, studyMinutesPerDay: 15, createdAt: new Date().toISOString() };
    await evaluate(cdp, `localStorage.clear();localStorage.setItem('klearn_users',${JSON.stringify(JSON.stringify([user]))});localStorage.setItem('klearn_session',${JSON.stringify(JSON.stringify({userId:user.id,createdAt:new Date().toISOString()}))});localStorage.setItem('klearn_progress',${JSON.stringify(JSON.stringify({[user.id]:{stats:{streak:2,lessonsCompleted:0,learningDays:0,wordsLearned:0},skills:{},lessonProgress:{},daily:{}}}))});location.hash='#home';location.reload()`);
    assert.equal(await until(cdp, `Boolean(window.KLEARN_APP?.state?.currentUser&&document.querySelector('.p2-navigation-hub'))`), true, 'Ôn & thi hub missing');
    assert.equal(await evaluate(cdp, `['TOPIK','Ôn tập SRS','Sổ lỗi','Công cụ offline','Tiến độ'].every((text)=>document.body.textContent.includes(text))`), true, 'stable destinations not discoverable');

    await evaluate(cdp, `window.KLEARN_APP.setView('listening-studio')`); assert.equal(await until(cdp, `window.KLEARN_APP.state.currentView==='listening-studio'&&Boolean(document.querySelector('[data-listening-toggle="translation"]'))`), true);
    assert.equal(await evaluate(cdp, `!document.querySelector('[data-listening-toggle="translation"]').checked`), true, 'Vietnamese meaning is visible by default');
    await evaluate(cdp, `document.querySelector('[data-listening-toggle="translation"]').click()`); assert.equal(await until(cdp, `document.querySelector('[data-listening-toggle="translation"]').checked&&document.body.textContent.includes('Ẩn nghĩa tiếng Việt')`), true);
    await evaluate(cdp, `window.KLEARN_APP.setView('listening-studio')`); assert.equal(await evaluate(cdp, `document.querySelector('[data-listening-toggle="translation"]').checked`), true, 'listening preference was not retained');

    await evaluate(cdp, `window.ErrorNotebookService.add({type:'vocabulary',question:'학교',mistake:'x',correction:'trường học',timestamp:'2026-09-26T17:08:57.062Z',source:'unknown'});window.KLEARN_APP.setView('error-notebook')`); assert.equal(await until(cdp, `Boolean(document.querySelector('.error-card'))`), true); const errorText = await evaluate(cdp, `document.body.textContent`); assert.equal(/\d{2}\/09\/2026, \d{2}:\d{2}/.test(errorText)&&errorText.includes('Không thể mở bài gốc'), true, `Error Notebook did not normalize timestamp/source fallback: ${errorText.slice(0, 600)}`);

    await evaluate(cdp, `window.KLEARN_APP.setView('adaptive-plan')`); assert.equal(await until(cdp, `Boolean(document.querySelector('.adaptive-progressive-disclosure')&&document.querySelector('#adaptiveGoalForm'))`), true, 'Learning Plan disclosure missing');
    assert.equal(await evaluate(cdp, `document.querySelectorAll('[data-adaptive-start]').length>0`), true, 'Adaptive direct actions missing');
    for (const width of [320, 360, 390, 430, 768, 1024, 1440, 1920]) { await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 }); assert.equal(await evaluate(cdp, `document.documentElement.scrollWidth<=innerWidth`), true, `horizontal overflow at ${width}px`); }
    await evaluate(cdp, `window.KLEARN_APP.setView('ai-coach')`); assert.equal(await until(cdp, `Boolean(document.querySelector('[data-ai-companion]'))`), true); assert.equal(await evaluate(cdp, `!document.body.textContent.includes('AI QUALITY & COST')&&!document.body.textContent.includes('Token 30 ngày')`), true, 'operator telemetry leaked to learner');

    await evaluate(cdp, `window.KLEARN_EXTRA_VIEWS.__p2Broken=()=>{throw new Error('simulated route failure')};window.KLEARN_APP.setView('__p2Broken')`); assert.equal(await until(cdp, `document.body.textContent.includes('Không thể mở trang này.')&&Boolean(document.querySelector('[data-route-retry]'))`), true, 'route fallback missing');
    console.log(JSON.stringify({ status: 'passed', scenarios: ['navigation-hub', 'listening-korean-first', 'listening-preference', 'error-notebook-format', 'adaptive-disclosure', 'adaptive-cta', 'telemetry-hidden', 'route-fallback'] }));
  } finally { cdp?.close(); browser.kill(); server.kill(); try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 12, retryDelay: 200 }); } catch (_) {} }
})().catch((error) => { console.error(error); process.exitCode = 1; });
