/* Real-browser P25 QA: node tests/content-quality-responsive.browser.js [url] */
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const edge = [path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')].find((candidate) => candidate && fs.existsSync(candidate));
if (!edge) throw new Error('Microsoft Edge is required for responsive browser QA.');
const baseUrl = process.argv[2] || 'http://127.0.0.1:4173/';
const port = 10420 + Math.floor(Math.random() * 70);
const profile = path.join(os.tmpdir(), `klearn-p25-browser-${process.pid}`);
const browser = childProcess.spawn(edge, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--disable-gpu', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore', windowsHide: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function json(url, options) { const response = await fetch(url, options); if (!response.ok) throw new Error(`${response.status} ${url}`); return response.json(); }
async function connect(url) { const socket = new WebSocket(url); let id = 0; const pending = new Map(); await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; }); socket.onmessage = (event) => { const message = JSON.parse(event.data); const request = pending.get(message.id); if (!request) return; pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); }; return { send(method, params = {}) { return new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })); }); }, close() { socket.close(); } }; }
async function evaluate(cdp, expression) { const output = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (output.exceptionDetails) throw new Error(output.exceptionDetails.exception?.description || output.exceptionDetails.text); return output.result.value; }
async function until(cdp, expression, attempts = 100) { for (let attempt = 0; attempt < attempts; attempt += 1) { if (await evaluate(cdp, expression)) return true; await wait(100); } return false; }

(async () => {
  try {
    let version; for (let attempt = 0; attempt < 50 && !version; attempt += 1) { try { version = await json(`http://127.0.0.1:${port}/json/version`); } catch (_) { await wait(100); } }
    if (!version) throw new Error('Could not start Edge.');
    const target = await json(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`, { method: 'PUT' });
    const cdp = await connect(target.webSocketDebuggerUrl); await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    assert.equal(await until(cdp, `location.origin !== 'null' && document.readyState === 'complete'`), true, 'page did not load');
    const timestamp = new Date().toISOString(); const user = { id: 'p25-qa', fullName: 'P25 QA', email: 'p25@local.test', level: 'TOPIK 1', onboardingCompleted: true, createdAt: timestamp };
    await evaluate(cdp, `(() => { const user=${JSON.stringify(user)}; localStorage.setItem('klearn_users',JSON.stringify([user])); localStorage.setItem('klearn_session',JSON.stringify({userId:user.id,createdAt:${JSON.stringify(timestamp)}})); localStorage.setItem('klearn_progress',JSON.stringify({[user.id]:{skills:{},stats:{streak:1},lessonProgress:{},daily:{date:${JSON.stringify(timestamp.slice(0,10))},tasks:{}}}})); localStorage.setItem('klearn_settings',JSON.stringify({users:{[user.id]:{theme:'dark',language:'vi'}}})); location.hash='content-platform'; location.reload(); })()`);
    assert.equal(await until(cdp, `Boolean(document.querySelector('.acp-hero'))`), true, 'content platform did not render');
    await evaluate(cdp, `document.querySelector('[data-content-open="grammar-topic-particle"]').click()`); await wait(150);
    assert.equal(await until(cdp, `Boolean(document.querySelector('[data-p25-trust]'))`), true, 'quality trust panel did not render');
    assert.equal(await evaluate(cdp, `document.body.textContent.includes('Native checked') && document.body.textContent.includes('TOPIK curriculum')`), true, 'trust metadata missing');
    const results = [];
    for (const width of [360, 768, 1024, 1440, 1920]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 1100, deviceScaleFactor: 1, mobile: false }); await wait(100);
      const metrics = await evaluate(cdp, `(() => { const rect=(node)=>{const value=node?.getBoundingClientRect();return value?{left:value.left,width:value.width,right:value.right}:null}; const app=document.getElementById('app'), nav=document.getElementById('bottomNav'); return {width:innerWidth,dark:document.documentElement.dataset.theme==='dark',htmlOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,bodyOverflow:document.body.scrollWidth>document.body.clientWidth,app:rect(app),nav:rect(nav)}; })()`);
      assert.equal(metrics.dark, true, `dark mode missing at ${width}px`); assert.equal(metrics.htmlOverflow, false, `html overflow at ${width}px`); assert.equal(metrics.bodyOverflow, false, `body overflow at ${width}px`);
      if (width >= 1024) { assert.ok(metrics.nav.width >= 240 && metrics.nav.width <= 280, `sidebar invalid at ${width}px`); assert.ok(metrics.app.left >= 240, `content overlaps sidebar at ${width}px`); } else { assert.ok(metrics.app.left < 2, `compact content offset at ${width}px`); }
      results.push({ width, sidebar: Math.round(metrics.nav.width), overflow: metrics.htmlOverflow });
    }
    await evaluate(cdp, `(() => { const form=document.querySelector('[data-p25-report-form]'); form.message.value='Audio hơi nhanh ở ví dụ này.'; form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})); })()`); await wait(80);
    assert.equal(await evaluate(cdp, `localStorage.getItem('klearn_content_feedback')?.includes('P25')`), true, 'quality report did not persist');
    await evaluate(cdp, `window.KLEARN_APP.setView('content-quality-dashboard')`); await wait(100);
    assert.equal(await evaluate(cdp, `document.body.textContent.includes('Không có quyền truy cập')`), true, 'student reached content health dashboard');
    console.log(JSON.stringify(results)); console.log('content quality responsive: trust panel, source transparency, report persistence, 360, 768, 1024, 1440, 1920, dark mode, overflow and admin privacy passed'); cdp.close();
  } finally { browser.kill(); await wait(200); fs.rmSync(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 }); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
