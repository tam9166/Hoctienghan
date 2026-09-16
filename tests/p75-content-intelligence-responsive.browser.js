/* Real-browser P75 QA: node tests/p75-content-intelligence-responsive.browser.js [url] */
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const edge = [path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')].find((candidate) => candidate && fs.existsSync(candidate));
if (!edge) throw new Error('Microsoft Edge is required for responsive browser QA.');
const baseUrl = process.argv[2] || 'http://127.0.0.1:4173/';
const port = 11010 + Math.floor(Math.random() * 70);
const profile = path.join(os.tmpdir(), `klearn-p75-browser-${process.pid}`);
const browser = childProcess.spawn(edge, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--disable-gpu', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore', windowsHide: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function json(url, options) { const response = await fetch(url, options); if (!response.ok) throw new Error(`${response.status} ${url}`); return response.json(); }
async function connect(url) { const socket = new WebSocket(url); let id = 0; const pending = new Map(); await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; }); socket.onmessage = (event) => { const message = JSON.parse(event.data); const request = pending.get(message.id); if (!request) return; pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); }; return { send(method, params = {}) { return new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })); }); }, close() { socket.close(); } }; }
async function evaluate(cdp, expression) { const output = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (output.exceptionDetails) throw new Error(output.exceptionDetails.exception?.description || output.exceptionDetails.text); return output.result.value; }
async function until(cdp, expression, attempts = 180) { for (let attempt = 0; attempt < attempts; attempt += 1) { if (await evaluate(cdp, expression)) return true; await wait(100); } return false; }

(async () => {
  let cdp;
  try {
    let version; for (let attempt = 0; attempt < 60 && !version; attempt += 1) { try { version = await json(`http://127.0.0.1:${port}/json/version`); } catch (_) { await wait(100); } }
    if (!version) throw new Error('Could not start Edge.');
    const target = await json(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(`${baseUrl}?p75=1`)}`, { method: 'PUT' });
    cdp = await connect(target.webSocketDebuggerUrl); await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    assert.equal(await until(cdp, `location.origin !== 'null' && document.readyState === 'complete'`), true, 'page did not load');
    const timestamp = new Date().toISOString();
    const user = { id: 'p75-browser', fullName: 'Người học P75', email: 'p75@local.test', level: 'Level 0', learningTrack: 'foundation', goals: ['conversation'], studyMinutesPerDay: 15, currentTopikLevel: 0, onboardingCompleted: true, createdAt: timestamp };
    await evaluate(cdp, `(() => { const user=${JSON.stringify(user)}; localStorage.clear(); localStorage.setItem('klearn_users',JSON.stringify([user])); localStorage.setItem('klearn_session',JSON.stringify({userId:user.id,createdAt:${JSON.stringify(timestamp)}})); localStorage.setItem('klearn_progress',JSON.stringify({[user.id]:{p75Marker:'keep-me',foundation:{learnedCharacters:['ㅏ']},skills:{listening:25},stats:{streak:2},lessonProgress:{legacy:{completed:true,score:91}},daily:{}}})); localStorage.setItem('klearn_settings',JSON.stringify({users:{[user.id]:{theme:'dark',language:'vi'}}})); location.hash='home'; location.reload(); })()`);
    assert.equal(await until(cdp, `Boolean(window.KLEARN_APP?.state?.currentUser && document.querySelector('[data-p74-home]'))`), true, 'authenticated Home did not load');
    console.log('P75 browser: authenticated Home ready');
    await evaluate(cdp, `KLEARN_APP.setView('content-intelligence')`);
    console.log('P75 browser: navigation dispatched');
    const hubReady = await until(cdp, `Boolean(window.ContentIntelligencePlatform && document.querySelector('.p75-action-grid'))`);
    if (!hubReady) console.error(await evaluate(cdp, `({view:window.KLEARN_APP?.state?.currentView,body:document.getElementById('app')?.innerText,loaded:window.KLEARN_ROUTE_LOADER?.loaded?.()})`));
    assert.equal(hubReady, true, 'P75 hub did not render');
    console.log('P75 browser: hub ready');
    assert.equal(await evaluate(cdp, `Object.values(ContentEntityRegistryService.migrationAudit().types).filter(Boolean).length`), 9, 'not all content types are represented');
    assert.equal(await evaluate(cdp, `ContentEntityRegistryService.migrationAudit().invalid.length`), 0, 'invalid migrated entity');
    assert.equal(await evaluate(cdp, `document.querySelectorAll('.p75-action-grid > button').length`), 3, 'student should see three non-admin actions');

    const results = [];
    for (const width of [360, 390, 430, 768, 1024, 1440, 1920]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 1100, deviceScaleFactor: 1, mobile: width <= 430 }); await wait(120);
      const metrics = await evaluate(cdp, `(() => { const root=document.documentElement, app=document.getElementById('app'), grid=document.querySelector('.p75-action-grid'); return {width:innerWidth,dark:root.dataset.theme==='dark',htmlOverflow:root.scrollWidth>root.clientWidth,bodyOverflow:document.body.scrollWidth>document.body.clientWidth,appRight:Math.round(app.getBoundingClientRect().right),columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length,minTouch:Math.min(...[...grid.querySelectorAll('button')].map((button)=>button.getBoundingClientRect().height))}; })()`);
      assert.equal(metrics.dark, true, `dark mode missing at ${width}px`);
      assert.equal(metrics.htmlOverflow, false, `html overflow at ${width}px`);
      assert.equal(metrics.bodyOverflow, false, `body overflow at ${width}px`);
      assert.ok(metrics.appRight <= width + 1, `app exceeds ${width}px viewport`);
      assert.equal(metrics.columns, width <= 560 ? 1 : width <= 1023 ? 2 : 4, `action columns invalid at ${width}px`);
      assert.ok(metrics.minTouch >= 44, `touch target below 44px at ${width}px`);
      results.push({ width, columns: metrics.columns, overflow: false });
    }

    await evaluate(cdp, `KLEARN_APP.setView('content-performance')`);
    assert.equal(await until(cdp, `Boolean(document.querySelector('.p75-table'))`), true, 'performance route missing');
    await evaluate(cdp, `KLEARN_APP.setView('content-gaps')`);
    assert.equal(await until(cdp, `document.querySelectorAll('.p75-gap-grid > article').length > 0`), true, 'gap analysis missing');
    await evaluate(cdp, `KLEARN_APP.setView('content-pack-manager')`);
    assert.equal(await until(cdp, `document.querySelectorAll('.p75-pack-grid > article').length === 4`), true, 'content pack catalog missing');
    assert.equal(await evaluate(cdp, `JSON.parse(localStorage.getItem('klearn_progress'))['p75-browser'].p75Marker`), 'keep-me', 'existing progress was changed');
    assert.equal(await evaluate(cdp, `localStorage.getItem('klearn_content_intelligence')`), null, 'read-only visit wrote an editor workspace');
    console.log(JSON.stringify({ status: 'passed', widths: results, dark: true, entityTypes: 9, packs: 4, progressPreserved: true, readOnlyVisitNoWorkspaceWrite: true }, null, 2));
  } finally {
    try { cdp?.close(); } catch (_) {}
    browser.kill(); await wait(300);
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 120 }); } catch (_) {}
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
