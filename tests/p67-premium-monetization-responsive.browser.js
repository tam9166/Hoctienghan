/* Real-browser P67 QA: node tests/p67-premium-monetization-responsive.browser.js [url] */
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const edge = [path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')].find((candidate) => candidate && fs.existsSync(candidate));
if (!edge) throw new Error('Microsoft Edge is required for responsive browser QA.');
const baseUrl = process.argv[2] || 'http://127.0.0.1:4173/';
const port = 10740 + Math.floor(Math.random() * 70);
const profile = path.join(os.tmpdir(), `klearn-p67-browser-${process.pid}`);
const browser = childProcess.spawn(edge, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--disable-gpu', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore', windowsHide: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function json(url, options) { const response = await fetch(url, options); if (!response.ok) throw new Error(`${response.status} ${url}`); return response.json(); }
async function connect(url) { const socket = new WebSocket(url); let id = 0; const pending = new Map(); await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; }); socket.onmessage = (event) => { const message = JSON.parse(event.data); const request = pending.get(message.id); if (!request) return; pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); }; return { send(method, params = {}) { return new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })); }); }, close() { socket.close(); } }; }
async function evaluate(cdp, expression) { const output = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (output.exceptionDetails) throw new Error(output.exceptionDetails.exception?.description || output.exceptionDetails.text); return output.result.value; }
async function until(cdp, expression, attempts = 140) { for (let attempt = 0; attempt < attempts; attempt += 1) { if (await evaluate(cdp, expression)) return true; await wait(100); } return false; }

(async () => {
  try {
    let version; for (let attempt = 0; attempt < 50 && !version; attempt += 1) { try { version = await json(`http://127.0.0.1:${port}/json/version`); } catch (_) { await wait(100); } }
    if (!version) throw new Error('Could not start Edge.');
    const target = await json(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`, { method: 'PUT' });
    const cdp = await connect(target.webSocketDebuggerUrl); await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    assert.equal(await until(cdp, `location.origin !== 'null' && document.readyState === 'complete'`), true, 'page did not load');
    const timestamp = new Date().toISOString(); const user = { id: 'p67-qa', fullName: 'P67 QA', email: 'p67@local.test', level: 'TOPIK 1', onboardingCompleted: true, createdAt: timestamp };
    await evaluate(cdp, `(() => { const user=${JSON.stringify(user)}; localStorage.clear(); localStorage.setItem('klearn_users',JSON.stringify([user])); localStorage.setItem('klearn_session',JSON.stringify({userId:user.id,createdAt:${JSON.stringify(timestamp)}})); localStorage.setItem('klearn_progress',JSON.stringify({[user.id]:{p67RegressionMarker:'keep-me',skills:{},stats:{streak:1},lessonProgress:{},daily:{date:${JSON.stringify(timestamp.slice(0,10))},tasks:{}}}})); localStorage.setItem('klearn_settings',JSON.stringify({schemaVersion:13,users:{[user.id]:{theme:'dark',language:'vi'}}})); location.hash='premium-center'; location.reload(); })()`);
    assert.equal(await until(cdp, `Boolean(document.querySelector('.p67-plans .p67-plan'))`), true, 'P67 plan center did not render');
    assert.equal(await evaluate(cdp, `document.querySelectorAll('.p67-plan').length === 3 && document.body.textContent.includes('không pay-to-learn')`), true, 'three ethical plan cards are missing');
    assert.equal(await evaluate(cdp, `window.FeaturePermissionService.access('hangul_foundation').allowed && !window.FeaturePermissionService.access('career_korean').allowed && window.FeaturePermissionService.access('ai_assistance').limit === 5`), true, 'Free access contract failed');

    const results = [];
    for (const width of [360, 768, 1024, 1440, 1920]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 1100, deviceScaleFactor: 1, mobile: false }); await wait(100);
      const metrics = await evaluate(cdp, `(() => { const rect=(node)=>{const value=node?.getBoundingClientRect();return value?{left:value.left,width:value.width,right:value.right}:null}; const app=document.getElementById('app'), nav=document.getElementById('bottomNav'); return {width:innerWidth,dark:document.documentElement.dataset.theme==='dark',htmlOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,bodyOverflow:document.body.scrollWidth>document.body.clientWidth,app:rect(app),nav:rect(nav),plans:rect(document.querySelector('.p67-plans'))}; })()`);
      assert.equal(metrics.dark, true, `dark mode missing at ${width}px`); assert.equal(metrics.htmlOverflow, false, `html overflow at ${width}px`); assert.equal(metrics.bodyOverflow, false, `body overflow at ${width}px`); assert.ok(metrics.plans.width <= width, `plans exceed viewport at ${width}px`);
      if (width >= 1024) { assert.ok(metrics.nav.width >= 240 && metrics.nav.width <= 280, `sidebar invalid at ${width}px`); assert.ok(metrics.app.left >= 240, `content overlaps sidebar at ${width}px`); } else { assert.ok(metrics.app.left < 2, `compact content offset at ${width}px`); }
      results.push({ width, sidebar: Math.round(metrics.nav.width), overflow: metrics.htmlOverflow });
    }

    await evaluate(cdp, `window.ServerEntitlementService.acceptServerProjection({plan:'premium',status:'active',end_date:'2099-01-01T00:00:00Z'}); window.KLEARN_APP.render()`); await wait(100);
    assert.equal(await evaluate(cdp, `window.ServerEntitlementService.activeTier()==='premium' && window.FeaturePermissionService.access('full_topik_roadmap').allowed && !window.FeaturePermissionService.access('career_korean').allowed`), true, 'Premium entitlement failed');
    await evaluate(cdp, `window.ServerEntitlementService.acceptServerProjection({plan:'pro',status:'active',end_date:'2099-01-01T00:00:00Z'}); window.KLEARN_APP.render()`); await wait(100);
    assert.equal(await evaluate(cdp, `window.FeaturePermissionService.access('career_korean').allowed && window.FeaturePermissionService.access('professional_writing').allowed`), true, 'Pro entitlement failed');
    await evaluate(cdp, `window.ServerEntitlementService.acceptServerProjection({plan:'premium',status:'expired',end_date:'2020-01-01T00:00:00Z'}); window.KLEARN_APP.render()`); await wait(100);
    assert.equal(await evaluate(cdp, `window.ServerEntitlementService.activeTier()==='free' && window.FeaturePermissionService.access('basic_srs').allowed`), true, 'expired fallback failed');
    assert.equal(await evaluate(cdp, `localStorage.getItem('klearn_progress').includes('keep-me') && !JSON.stringify(window.KLEARN_APP.CloudSyncService.snapshot()).includes('klearn_subscription_entitlement_cache')`), true, 'progress or CloudSync isolation failed');

    await evaluate(cdp, `window.ServerEntitlementService.acceptServerProjection({plan:'premium',status:'active',end_date:'2099-01-01T00:00:00Z'}); window.KLEARN_APP.render()`); await wait(80);
    assert.equal(await until(cdp, `navigator.serviceWorker?.controller && Boolean(document.querySelector('.p67-plan'))`), true, 'service worker did not control P67 route');
    await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 }); await evaluate(cdp, `location.reload()`);
    assert.equal(await until(cdp, `document.readyState === 'complete' && Boolean(document.querySelector('.p67-plan'))`), true, 'P67 route did not reopen offline');
    assert.equal(await evaluate(cdp, `window.ServerEntitlementService.current().source === 'server-cache' && window.ServerEntitlementService.activeTier() === 'premium'`), true, 'offline verified entitlement cache failed');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    console.log(JSON.stringify(results)); console.log('P67 responsive: 360/768/1024/1440/1920, dark, no overflow, Free/Premium/Pro/expired, progress isolation and offline cache passed'); cdp.close();
  } finally { browser.kill(); await wait(200); fs.rmSync(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 }); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
