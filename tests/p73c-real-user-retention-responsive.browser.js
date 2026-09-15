/* Real-browser P73C QA: node tests/p73c-real-user-retention-responsive.browser.js [url] */
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const edge = [path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')].find((candidate) => candidate && fs.existsSync(candidate));
if (!edge) throw new Error('Microsoft Edge is required for responsive browser QA.');
const baseUrl = process.argv[2] || 'http://127.0.0.1:4174/';
const port = 10830 + Math.floor(Math.random() * 70);
const profile = path.join(os.tmpdir(), `klearn-p73c-browser-${process.pid}`);
const browser = childProcess.spawn(edge, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--disable-gpu', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore', windowsHide: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function json(url, options) { const response = await fetch(url, options); if (!response.ok) throw new Error(`${response.status} ${url}`); return response.json(); }
async function connect(url) { const socket = new WebSocket(url); let id = 0; const pending = new Map(); await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; }); socket.onmessage = (event) => { const message = JSON.parse(event.data); const request = pending.get(message.id); if (!request) return; pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); }; return { send(method, params = {}) { return new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })); }); }, close() { socket.close(); } }; }
async function evaluate(cdp, expression) { const output = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (output.exceptionDetails) throw new Error(output.exceptionDetails.exception?.description || output.exceptionDetails.text); return output.result.value; }
async function until(cdp, expression, attempts = 140) { for (let attempt = 0; attempt < attempts; attempt += 1) { if (await evaluate(cdp, expression)) return true; await wait(100); } return false; }

(async () => {
  let cdp;
  try {
    let version; for (let attempt = 0; attempt < 50 && !version; attempt += 1) { try { version = await json(`http://127.0.0.1:${port}/json/version`); } catch (_) { await wait(100); } }
    if (!version) throw new Error('Could not start Edge.');
    const target = await json(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(`${baseUrl}?p73c=4`)}`, { method: 'PUT' });
    cdp = await connect(target.webSocketDebuggerUrl); await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    assert.equal(await until(cdp, `location.origin !== 'null' && document.readyState === 'complete'`), true, 'page did not load');
    const timestamp = new Date().toISOString();
    const user = { id: 'p73c-browser', fullName: 'Người học P73C', email: 'p73c@local.test', level: 'Level 0', learningTrack: 'foundation', learningMode: 'casual', goals: ['conversation'], studyMinutesPerDay: 5, currentTopikLevel: 0, onboardingCompleted: true, createdAt: timestamp };
    await evaluate(cdp, `(() => { const user=${JSON.stringify(user)}; localStorage.clear(); localStorage.setItem('klearn_users',JSON.stringify([user])); localStorage.setItem('klearn_session',JSON.stringify({userId:user.id,createdAt:${JSON.stringify(timestamp)}})); localStorage.setItem('klearn_progress',JSON.stringify({[user.id]:{p73cMarker:'keep-me',foundation:{learnedCharacters:['ㅏ','ㅑ','ㅓ','ㅕ','ㄱ'],updatedAt:${JSON.stringify(timestamp)}},skills:{},stats:{streak:0},lessonProgress:{},daily:{date:${JSON.stringify(timestamp.slice(0, 10))},tasks:{}}}})); localStorage.setItem('klearn_settings',JSON.stringify({users:{[user.id]:{theme:'dark',language:'vi'}}})); location.hash='home'; location.reload(); })()`);
    assert.equal(await until(cdp, `Boolean(window.ReturnLoopService && document.querySelector('[data-p73c-home]'))`), true, 'first-load return loop card missing');
    assert.equal(await evaluate(cdp, `document.querySelectorAll('[data-p73c-home]').length`), 1, 'return loop card duplicated');
    await evaluate(cdp, `KLEARN_APP.setView('real-user-retention')`);
    assert.equal(await until(cdp, `Boolean(document.querySelector('.p73c-hub-grid'))`), true, 'P73C hub did not render');
    assert.equal(await evaluate(cdp, `document.querySelectorAll('.p73c-hub-grid > button').length`), 6, 'P73C hub actions missing');

    const results = [];
    for (const width of [360, 390, 430, 768, 1024, 1440, 1920]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 1100, deviceScaleFactor: 1, mobile: false }); await wait(100);
      if (!await until(cdp, `Boolean(document.querySelector('.p73c-hub-grid'))`, 20)) {
        await evaluate(cdp, `KLEARN_APP.setView('real-user-retention')`);
        const restored = await until(cdp, `Boolean(document.querySelector('.p73c-hub-grid'))`);
        if (!restored) { const diagnostic = await evaluate(cdp, `({hash:location.hash,view:KLEARN_APP?.state?.currentView,user:KLEARN_APP?.state?.currentUser?.id||null,text:document.getElementById('app')?.innerText?.slice(0,180)})`); throw new Error(`P73C hub missing at ${width}px: ${JSON.stringify(diagnostic)}`); }
      }
      const metrics = await evaluate(cdp, `(() => { const root=document.documentElement, app=document.getElementById('app'), grid=document.querySelector('.p73c-hub-grid'); return {width:innerWidth,dark:document.documentElement.dataset.theme==='dark',htmlOverflow:root.scrollWidth>root.clientWidth,bodyOverflow:document.body.scrollWidth>document.body.clientWidth,appRight:app.getBoundingClientRect().right,columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length}; })()`);
      assert.equal(metrics.dark, true, `dark mode missing at ${width}px`);
      assert.equal(metrics.htmlOverflow, false, `html overflow at ${width}px`);
      assert.equal(metrics.bodyOverflow, false, `body overflow at ${width}px`);
      assert.ok(metrics.appRight <= width + 1, `app exceeds ${width}px viewport`);
      assert.equal(metrics.columns, width <= 560 ? 1 : width <= 800 ? 2 : 3, `hub columns invalid at ${width}px`);
      results.push({ width, columns: metrics.columns, overflow: metrics.htmlOverflow });
    }

    await evaluate(cdp, `KLEARN_APP.setView('real-korean-missions')`);
    assert.equal(await until(cdp, `document.querySelectorAll('.p73c-scenarios > article').length === 7`), true, 'seven real Korean scenarios missing');
    assert.equal(await evaluate(cdp, `document.querySelectorAll('.p73c-mission-tracks > article').length`), 3, 'beginner/intermediate/advanced mission tracks missing');
    await evaluate(cdp, `document.querySelector('[data-p73c-scenario="restaurant-order"]').click()`);
    assert.equal(await until(cdp, `Boolean(document.getElementById('p73cMissionForm'))`), true, 'mission screen did not render');
    await evaluate(cdp, `(() => { const form=document.getElementById('p73cMissionForm'); form.querySelector('textarea').value='김치찌개 하나와 물 주세요.'; form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})); })()`); await wait(100);
    assert.equal(await evaluate(cdp, `Boolean(document.querySelector('.p73c-feedback.passed'))`), true, 'mission feedback was not shown');
    assert.equal(await evaluate(cdp, `!JSON.stringify(JSON.parse(localStorage.getItem('klearn_real_user_retention'))).includes('audio')`), true, 'audio data was persisted');
    assert.equal(await evaluate(cdp, `JSON.parse(localStorage.getItem('klearn_progress'))['p73c-browser'].p73cMarker`), 'keep-me', 'existing progress was changed');
    console.log(JSON.stringify({ status: 'passed', widths: results, dark: true, scenarios: 7, progressPreserved: true }, null, 2));
  } finally {
    try { cdp?.close(); } catch (_) {}
    browser.kill(); await wait(300);
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 120 }); } catch (_) {}
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
