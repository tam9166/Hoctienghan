/* Real-browser P74 QA: node tests/p74-product-delight-responsive.browser.js [url] */
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const edge = [path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')].find((candidate) => candidate && fs.existsSync(candidate));
if (!edge) throw new Error('Microsoft Edge is required for responsive browser QA.');
const baseUrl = process.argv[2] || 'http://127.0.0.1:4173/';
const port = 10910 + Math.floor(Math.random() * 70);
const profile = path.join(os.tmpdir(), `klearn-p74-browser-${process.pid}`);
const browser = childProcess.spawn(edge, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--disable-gpu', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore', windowsHide: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function json(url, options) { const response = await fetch(url, options); if (!response.ok) throw new Error(`${response.status} ${url}`); return response.json(); }
async function connect(url) { const socket = new WebSocket(url); let id = 0; const pending = new Map(); await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; }); socket.onmessage = (event) => { const message = JSON.parse(event.data); const request = pending.get(message.id); if (!request) return; pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); }; return { send(method, params = {}) { return new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })); }); }, close() { socket.close(); } }; }
async function evaluate(cdp, expression) { const output = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (output.exceptionDetails) throw new Error(output.exceptionDetails.exception?.description || output.exceptionDetails.text); return output.result.value; }
async function until(cdp, expression, attempts = 160) { for (let attempt = 0; attempt < attempts; attempt += 1) { if (await evaluate(cdp, expression)) return true; await wait(100); } return false; }

(async () => {
  let cdp;
  try {
    let version; for (let attempt = 0; attempt < 60 && !version; attempt += 1) { try { version = await json(`http://127.0.0.1:${port}/json/version`); } catch (_) { await wait(100); } }
    if (!version) throw new Error('Could not start Edge.');
    const target = await json(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(`${baseUrl}?p74=1`)}`, { method: 'PUT' });
    cdp = await connect(target.webSocketDebuggerUrl); await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    assert.equal(await until(cdp, `location.origin !== 'null' && document.readyState === 'complete'`), true, 'page did not load');
    const timestamp = new Date().toISOString();
    const user = { id: 'p74-browser', fullName: 'Người học P74', email: 'p74@local.test', level: 'Level 0', learningTrack: 'foundation', learningMode: 'casual', goals: ['conversation'], studyMinutesPerDay: 15, currentTopikLevel: 0, onboardingCompleted: true, createdAt: timestamp };
    await evaluate(cdp, `(() => { const user=${JSON.stringify(user)}; localStorage.clear(); localStorage.setItem('klearn_users',JSON.stringify([user])); localStorage.setItem('klearn_session',JSON.stringify({userId:user.id,createdAt:${JSON.stringify(timestamp)}})); localStorage.setItem('klearn_progress',JSON.stringify({[user.id]:{p74Marker:'keep-me',foundation:{learnedCharacters:['ㅏ'],updatedAt:${JSON.stringify(timestamp)}},skills:{},stats:{streak:0},lessonProgress:{},daily:{date:${JSON.stringify(timestamp.slice(0, 10))},tasks:{}}}})); localStorage.setItem('klearn_settings',JSON.stringify({users:{[user.id]:{theme:'dark',language:'vi'}}})); location.hash='home'; location.reload(); })()`);
    assert.equal(await until(cdp, `Boolean(window.ProductDelightContentService && document.querySelector('[data-p74-home]'))`), true, 'P74 Home companion missing');
    await wait(600);
    assert.equal(await until(cdp, `document.querySelectorAll('[data-p74-home]').length === 1`, 50), true, 'P74 Home companion did not settle');
    assert.equal(await evaluate(cdp, `document.querySelectorAll('[data-p73c-home]').length`), 1, 'Home companion duplicated');
    assert.equal(await evaluate(cdp, `document.querySelectorAll('[data-p74-home]').length`), 1, 'P74 Home consolidation duplicated');
    await evaluate(cdp, `KLEARN_APP.setView('product-delight')`);
    assert.equal(await until(cdp, `Boolean(document.querySelector('.p74-directory'))`), true, 'P74 hub did not render');
    assert.equal(await evaluate(cdp, `document.querySelectorAll('.p74-directory > button').length`), 8, 'P74 hub actions missing');

    const results = [];
    for (const width of [360, 390, 430, 768, 1024, 1440, 1920]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 1100, deviceScaleFactor: 1, mobile: width <= 430 }); await wait(120);
      const metrics = await evaluate(cdp, `(() => { const root=document.documentElement, app=document.getElementById('app'), grid=document.querySelector('.p74-directory'); return {width:innerWidth,dark:root.dataset.theme==='dark',htmlOverflow:root.scrollWidth>root.clientWidth,bodyOverflow:document.body.scrollWidth>document.body.clientWidth,appRight:Math.round(app.getBoundingClientRect().right),columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length,minTouch:Math.min(...[...grid.querySelectorAll('button')].map((button)=>button.getBoundingClientRect().height))}; })()`);
      assert.equal(metrics.dark, true, `dark mode missing at ${width}px`);
      assert.equal(metrics.htmlOverflow, false, `html overflow at ${width}px`);
      assert.equal(metrics.bodyOverflow, false, `body overflow at ${width}px`);
      assert.ok(metrics.appRight <= width + 1, `app exceeds ${width}px viewport`);
      assert.equal(metrics.columns, width <= 560 ? 1 : 2, `directory columns invalid at ${width}px`);
      assert.ok(metrics.minTouch >= 44, `touch target below 44px at ${width}px`);
      results.push({ width, columns: metrics.columns, overflow: metrics.htmlOverflow });
    }

    await evaluate(cdp, `KLEARN_APP.setView('delight-focus-session')`);
    assert.equal(await until(cdp, `document.querySelectorAll('.p74-focus-plan > li').length === 4`), true, '15-minute Focus plan missing');
    assert.deepEqual(await evaluate(cdp, `[...document.querySelectorAll('.p74-focus-plan > li > span')].map((item)=>Number(item.textContent))`), [3, 5, 5, 2]);
    await evaluate(cdp, `KLEARN_APP.setView('culture-context')`);
    assert.equal(await until(cdp, `document.querySelectorAll('.p74-culture > article').length === 6`), true, 'culture contexts missing');
    await evaluate(cdp, `KLEARN_APP.setView('career-journey')`);
    assert.equal(await until(cdp, `document.querySelectorAll('.p74-career-tabs > button').length === 4`), true, 'career paths missing');
    assert.equal(await evaluate(cdp, `JSON.parse(localStorage.getItem('klearn_progress'))['p74-browser'].p74Marker`), 'keep-me', 'existing progress was changed');
    console.log(JSON.stringify({ status: 'passed', widths: results, dark: true, focusMinutes: [3, 5, 5, 2], cultureContexts: 6, careerPaths: 4, progressPreserved: true }, null, 2));
  } finally {
    try { cdp?.close(); } catch (_) {}
    browser.kill(); await wait(300);
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 120 }); } catch (_) {}
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
