/* Real-browser P22 QA: node tests/enterprise-platform-responsive.browser.js [url] */
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const edge = [path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')].find((candidate) => candidate && fs.existsSync(candidate));
if (!edge) throw new Error('Microsoft Edge is required for responsive browser QA.');
const baseUrl = process.argv[2] || 'http://127.0.0.1:4173/';
const port = 10050 + Math.floor(Math.random() * 70); const profile = path.join(os.tmpdir(), `klearn-p22-browser-${process.pid}`);
const browser = childProcess.spawn(edge, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--disable-gpu', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore', windowsHide: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function json(url, options) { const response = await fetch(url, options); if (!response.ok) throw new Error(`${response.status} ${url}`); return response.json(); }
async function connect(url) { const socket = new WebSocket(url); let id = 0; const pending = new Map(); await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; }); socket.onmessage = (event) => { const message = JSON.parse(event.data); const request = pending.get(message.id); if (!request) return; pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); }; return { send(method, params = {}) { return new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })); }); }, close() { socket.close(); } }; }
async function evaluate(cdp, expression) { const output = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (output.exceptionDetails) throw new Error(output.exceptionDetails.exception?.description || output.exceptionDetails.text); return output.result.value; }

(async () => {
  try {
    let version; for (let attempt = 0; attempt < 50 && !version; attempt += 1) { try { version = await json(`http://127.0.0.1:${port}/json/version`); } catch (_) { await wait(100); } } if (!version) throw new Error('Could not start Edge.');
    const target = await json(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`, { method: 'PUT' }); const cdp = await connect(target.webSocketDebuggerUrl); await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    for (let attempt = 0; attempt < 80; attempt += 1) { if (await evaluate(cdp, `location.origin !== 'null' && document.readyState === 'complete'`)) break; await wait(100); }
    const timestamp = new Date().toISOString(); const user = { id: 'p22-qa', fullName: 'P22 QA', email: 'p22@local.test', level: 'TOPIK 1', onboardingCompleted: true, createdAt: timestamp };
    await evaluate(cdp, `(() => { localStorage.setItem('klearn_users', ${JSON.stringify(JSON.stringify([user]))}); localStorage.setItem('klearn_session', ${JSON.stringify(JSON.stringify({ userId: user.id, createdAt: timestamp }))}); localStorage.setItem('klearn_progress', ${JSON.stringify(JSON.stringify({ [user.id]: { skills: {}, stats: {}, lessonProgress: {}, daily: { date: timestamp.slice(0,10), tasks: {} } } }))}); localStorage.setItem('klearn_settings', ${JSON.stringify(JSON.stringify({ users: { [user.id]: { theme: 'dark', language: 'vi' } } }))}); location.hash='enterprise-platform'; location.reload(); })()`);
    for (let attempt = 0; attempt < 70; attempt += 1) { if (await evaluate(cdp, `Boolean(window.EnterpriseContentService && document.querySelector('.ep-launch-grid'))`)) break; await wait(100); }
    assert.equal(await evaluate(cdp, `Boolean(document.querySelector('.ep-launch-grid'))`), true, 'P22 hub did not render');
    assert.equal(await evaluate(cdp, `window.SubscriptionService.tier()`), 'free', 'local user must default to free');
    const results = [];
    for (const width of [360, 768, 1024, 1440, 1920]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false }); await wait(100);
      const metrics = await evaluate(cdp, `(() => { const rect=(node)=>{const value=node?.getBoundingClientRect();return value?{left:value.left,width:value.width,right:value.right}:null}; const app=document.getElementById('app'), nav=document.getElementById('bottomNav'), grid=document.querySelector('.ep-launch-grid'); return { width:innerWidth, hub:Boolean(grid), dark:document.documentElement.dataset.theme==='dark', overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth, bodyOverflow:document.body.scrollWidth>document.body.clientWidth, app:rect(app), nav:rect(nav), columns:grid?getComputedStyle(grid).gridTemplateColumns.split(' ').length:0 }; })()`);
      assert.equal(metrics.hub, true, `P22 hub missing at ${width}px`); assert.equal(metrics.dark, true, `dark mode missing at ${width}px`); assert.equal(metrics.overflow, false, `html overflow at ${width}px`); assert.equal(metrics.bodyOverflow, false, `body overflow at ${width}px`);
      if (width >= 1024) { assert.ok(metrics.nav.width >= 240 && metrics.nav.width <= 280, `sidebar invalid at ${width}px`); assert.ok(metrics.app.left >= 240, `content overlaps sidebar at ${width}px`); }
      else { assert.ok(metrics.app.left < 2, `compact content offset at ${width}px`); assert.ok(metrics.nav.width <= width, `bottom navigation overflow at ${width}px`); }
      const expected = width <= 600 ? 1 : width <= 800 ? 2 : width <= 1100 ? 3 : 4; assert.equal(metrics.columns, expected, `enterprise grid invalid at ${width}px`); results.push({ width, sidebar: Math.round(metrics.nav.width), columns: metrics.columns, overflow: metrics.overflow, dark: metrics.dark });
    }
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 1100, deviceScaleFactor: 1, mobile: false });
    await evaluate(cdp, `window.KLEARN_APP.setView('subscription-center')`); await wait(80); assert.equal(await evaluate(cdp, `document.body.textContent.includes('Thanh toán chưa được tích hợp')`), true);
    await evaluate(cdp, `window.KLEARN_APP.setView('course-marketplace')`); await wait(80); assert.equal(await evaluate(cdp, `document.querySelectorAll('[data-market-enroll][disabled]').length >= 2`), true, 'premium courses must be locked for free account'); await evaluate(cdp, `document.querySelector('[data-market-enroll="market-beginner-korean"]').click()`); await wait(80);
    await evaluate(cdp, `window.CourseMarketplaceService.recordProgress('market-beginner-korean', 100); window.KLEARN_APP.setView('certification-center')`); await wait(80); await evaluate(cdp, `document.querySelector('[data-certificate-issue="beginner-korean"]').click()`); await wait(80);
    await evaluate(cdp, `window.KLEARN_APP.setView('school-management')`); await wait(80); assert.equal(await evaluate(cdp, `Boolean(document.querySelector('.ep-denied'))`), true, 'student must not see school management');
    await evaluate(cdp, `window.KLEARN_APP.setView('partner-api')`); await wait(80); assert.equal(await evaluate(cdp, `document.body.textContent.includes('Chưa kích hoạt')`), true, 'partner API must be labelled inactive');
    await evaluate(cdp, `window.KLEARN_APP.setView('language-platform')`); await wait(80); assert.equal(await evaluate(cdp, `document.querySelectorAll('.ep-language-grid article').length`), 3); assert.equal(await evaluate(cdp, `document.documentElement.scrollWidth > document.documentElement.clientWidth`), false, 'language view overflows at 360px');
    const persisted = await evaluate(cdp, `localStorage.getItem('klearn_enterprise_platform') || ''`); for (const marker of ['market-beginner-korean','local-preview','beginner-korean']) assert.match(persisted, new RegExp(marker), `${marker} was not persisted`);
    console.log(JSON.stringify(results)); console.log('enterprise platform responsive: 360, 768, 1024, 1440, 1920, dark mode, subscription, marketplace, certification, RBAC, partner API and languages passed'); cdp.close();
  } finally { browser.kill(); await wait(200); fs.rmSync(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 }); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
