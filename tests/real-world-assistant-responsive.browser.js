/* Real-browser P19 QA: node tests/real-world-assistant-responsive.browser.js [url] */
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const edge = [path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')].find((candidate) => candidate && fs.existsSync(candidate));
if (!edge) throw new Error('Microsoft Edge is required for responsive browser QA.');
const baseUrl = process.argv[2] || 'http://127.0.0.1:4173/';
const port = 9700 + Math.floor(Math.random() * 200); const profile = path.join(os.tmpdir(), `klearn-p19-browser-${process.pid}`);
const browser = childProcess.spawn(edge, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--disable-gpu', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore', windowsHide: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function json(url, options) { const response = await fetch(url, options); if (!response.ok) throw new Error(`${response.status} ${url}`); return response.json(); }
async function connect(url) { const socket = new WebSocket(url); let id = 0; const pending = new Map(); await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; }); socket.onmessage = (event) => { const message = JSON.parse(event.data); const request = pending.get(message.id); if (!request) return; pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); }; return { send(method, params = {}) { return new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })); }); }, close() { socket.close(); } }; }
async function evaluate(cdp, expression) { const output = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (output.exceptionDetails) throw new Error(output.exceptionDetails.exception?.description || output.exceptionDetails.text); return output.result.value; }

(async () => {
  try {
    let version; for (let attempt = 0; attempt < 40 && !version; attempt += 1) { try { version = await json(`http://127.0.0.1:${port}/json/version`); } catch (_) { await wait(100); } } if (!version) throw new Error('Could not start Edge.');
    const target = await json(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`, { method: 'PUT' }); const cdp = await connect(target.webSocketDebuggerUrl); await cdp.send('Runtime.enable');
    const today = new Date().toISOString(); const user = { id: 'p19-qa', fullName: 'P19 QA', email: 'p19@local.test', level: 'TOPIK 1', currentTopikLevel: 1, targetTopikLevel: 2, onboardingCompleted: true };
    await evaluate(cdp, `(() => { localStorage.setItem('klearn_users', ${JSON.stringify(JSON.stringify([user]))}); localStorage.setItem('klearn_session', ${JSON.stringify(JSON.stringify({ userId: user.id, createdAt: today }))}); localStorage.setItem('klearn_progress', ${JSON.stringify(JSON.stringify({ [user.id]: { skills: {}, stats: { streak: 1 }, lessonProgress: {}, daily: { date: today.slice(0,10), tasks: {} } } }))}); localStorage.setItem('klearn_settings', ${JSON.stringify(JSON.stringify({ users: { [user.id]: { theme: 'dark', language: 'vi' } } }))}); location.hash='real-world-assistant'; location.reload(); })()`);
    for (let attempt = 0; attempt < 40; attempt += 1) { if (await evaluate(cdp, `Boolean(window.KLEARN_APP?.setView && window.RealWorldContentService)`)) break; await wait(100); }
    await evaluate(cdp, `window.KLEARN_APP.setView('real-world-assistant')`);
    for (let attempt = 0; attempt < 50; attempt += 1) { if (await evaluate(cdp, `Boolean(document.querySelector('.rw-reader-grid'))`)) break; await wait(100); }
    if (!await evaluate(cdp, `Boolean(document.querySelector('.rw-reader-grid'))`)) console.error(await evaluate(cdp, `({hash:location.hash,view:window.KLEARN_APP?.state?.currentView,error:window.KLEARN_APP?.state?.realWorldAssistant?.error,text:document.body.innerText.slice(0,500)})`));
    const results = [];
    for (const width of [360, 768, 1024, 1440, 1920]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false }); await wait(100);
      const metrics = await evaluate(cdp, `(() => { const rect=(node)=>{const value=node?.getBoundingClientRect();return value?{left:value.left,width:value.width,right:value.right}:null}; const app=document.getElementById('app'), nav=document.getElementById('bottomNav'), grid=document.querySelector('.rw-reader-grid'), culture=document.querySelector('.rw-culture'); return { width:innerWidth, hub:Boolean(grid), user:Boolean(window.KLEARN_APP.state.currentUser), navClass:nav?.className, dark:document.documentElement.dataset.theme==='dark', overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth, bodyOverflow:document.body.scrollWidth>document.body.clientWidth, app:rect(app), nav:rect(nav), readerColumns:grid?getComputedStyle(grid).gridTemplateColumns.split(' ').length:0, cultureColumns:culture?getComputedStyle(culture).gridTemplateColumns.split(' ').length:0 }; })()`);
      if (process.env.KLEARN_QA_DEBUG) console.log(metrics);
      assert.equal(metrics.hub, true, `P19 hub missing at ${width}px`); assert.equal(metrics.dark, true, `dark mode missing at ${width}px`); assert.equal(metrics.overflow, false, `html overflow at ${width}px`); assert.equal(metrics.bodyOverflow, false, `body overflow at ${width}px`);
      if (width >= 1024) { assert.ok(metrics.nav.width >= 240 && metrics.nav.width <= 280, `sidebar invalid at ${width}px`); assert.ok(metrics.app.left >= 240, `content overlaps sidebar at ${width}px`); }
      else { assert.ok(metrics.app.left < 2, `compact content offset at ${width}px`); assert.ok(metrics.nav.width <= width, `bottom navigation overflow at ${width}px`); }
      assert.equal(metrics.readerColumns, width <= 560 ? 1 : width <= 980 ? 2 : 4, `reader grid invalid at ${width}px`); results.push({ width, sidebar: Math.round(metrics.nav.width), readerColumns: metrics.readerColumns, overflow: metrics.overflow, dark: metrics.dark });
    }
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 1000, deviceScaleFactor: 1, mobile: false });
    await evaluate(cdp, `document.querySelector('[data-reader-mode="document"]').click()`); for (let attempt = 0; attempt < 20; attempt += 1) { if (await evaluate(cdp, `Boolean(document.getElementById('realWorldReaderForm'))`)) break; await wait(50); }
    await evaluate(cdp, `(() => { const field=document.querySelector('#realWorldReaderForm textarea'); field.value='계약서 보증금 월세'; document.getElementById('realWorldReaderForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})); })()`); await wait(100);
    assert.equal(await evaluate(cdp, `document.querySelector('.rw-analysis h2')?.textContent.includes('계약서')`), true, 'document analysis result missing');
    assert.equal(await evaluate(cdp, `document.documentElement.scrollWidth > document.documentElement.clientWidth`), false, 'document assistant overflows at 360px');
    assert.equal(await evaluate(cdp, `localStorage.getItem('klearn_ecosystem_expansion')?.includes('계약서') || false`), false, 'private document text leaked into storage');
    console.log(JSON.stringify(results)); console.log('real world assistant responsive: 360, 768, 1024, 1440, 1920, dark mode, interaction and private-text checks passed'); cdp.close();
  } finally { browser.kill(); await wait(150); fs.rmSync(profile, { recursive: true, force: true }); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
