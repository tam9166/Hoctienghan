/* Real-browser P39 QA: node tests/monetization-foundation-responsive.browser.js [url] */
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const edge = [path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')].find((candidate) => candidate && fs.existsSync(candidate));
if (!edge) throw new Error('Microsoft Edge is required for responsive browser QA.');
const baseUrl = process.argv[2] || 'http://127.0.0.1:4173/'; const port = 10680 + Math.floor(Math.random() * 70); const profile = path.join(os.tmpdir(), `klearn-p39-browser-${process.pid}`);
const browser = childProcess.spawn(edge, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--disable-gpu', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore', windowsHide: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function json(url, options) { const response = await fetch(url, options); if (!response.ok) throw new Error(`${response.status} ${url}`); return response.json(); }
async function connect(url) { const socket = new WebSocket(url); let id = 0; const pending = new Map(); await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; }); socket.onmessage = (event) => { const message = JSON.parse(event.data); const request = pending.get(message.id); if (!request) return; pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); }; return { send(method, params = {}) { return new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })); }); }, close() { socket.close(); } }; }
async function evaluate(cdp, expression) { const output = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (output.exceptionDetails) throw new Error(output.exceptionDetails.exception?.description || output.exceptionDetails.text); return output.result.value; }
async function until(cdp, expression, attempts = 100) { for (let attempt = 0; attempt < attempts; attempt += 1) { if (await evaluate(cdp, expression)) return true; await wait(100); } return false; }

(async () => {
  try {
    let version; for (let attempt = 0; attempt < 50 && !version; attempt += 1) { try { version = await json(`http://127.0.0.1:${port}/json/version`); } catch (_) { await wait(100); } } if (!version) throw new Error('Could not start Edge.');
    const target = await json(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`, { method: 'PUT' }); const cdp = await connect(target.webSocketDebuggerUrl); await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); assert.equal(await until(cdp, `location.origin !== 'null' && document.readyState === 'complete'`), true, 'page did not load');
    const timestamp = new Date().toISOString(); const user = { id: 'p39-qa', fullName: 'P39 Learner', email: 'p39@local.test', level: 'TOPIK 1', onboardingCompleted: true, createdAt: timestamp };
    await evaluate(cdp, `(() => { localStorage.setItem('klearn_users', ${JSON.stringify(JSON.stringify([user]))}); localStorage.setItem('klearn_session', ${JSON.stringify(JSON.stringify({ userId: user.id, createdAt: timestamp }))}); localStorage.setItem('klearn_progress', ${JSON.stringify(JSON.stringify({ [user.id]: { skills: {}, stats: { streak: 2 }, lessonProgress: {}, daily: { date: timestamp.slice(0,10), tasks: {} } } }))}); localStorage.setItem('klearn_settings', ${JSON.stringify(JSON.stringify({ users: { [user.id]: { theme: 'dark', language: 'vi' } } }))}); location.hash='business-center'; location.reload(); })()`);
    assert.equal(await until(cdp, `Boolean(window.MonetizationContentService && document.querySelector('.biz-launch-grid'))`), true, 'P39 Business Center did not render');
    assert.equal(await evaluate(cdp, `window.CommercialSubscriptionService.tier()`), 'free');
    assert.equal(await evaluate(cdp, `window.CommercialSubscriptionService.canActivateFromClient()`), false);

    const results = [];
    for (const width of [360, 768, 1024, 1440, 1920]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 1050, deviceScaleFactor: 1, mobile: false }); await wait(100);
      const metrics = await evaluate(cdp, `(() => { const app=document.getElementById('app'),nav=document.getElementById('bottomNav'),grid=document.querySelector('.biz-launch-grid');const rect=(node)=>{const r=node?.getBoundingClientRect();return r?{left:r.left,width:r.width,right:r.right}:null};return{dark:document.documentElement.dataset.theme==='dark',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,bodyOverflow:document.body.scrollWidth>document.body.clientWidth,app:rect(app),nav:rect(nav),columns:grid?getComputedStyle(grid).gridTemplateColumns.split(' ').length:0,minTouch:Math.min(...[...document.querySelectorAll('.biz-launch-grid button')].map((node)=>node.getBoundingClientRect().height))};})()`);
      assert.equal(metrics.dark, true, `dark mode missing at ${width}px`); assert.equal(metrics.overflow, false, `html overflow at ${width}px`); assert.equal(metrics.bodyOverflow, false, `body overflow at ${width}px`); assert.ok(metrics.minTouch >= 44, `touch target too small at ${width}px`);
      if (width >= 1024) { assert.ok(metrics.nav.width >= 240 && metrics.nav.width <= 280, `sidebar invalid at ${width}px`); assert.ok(metrics.app.left >= 240, `content overlaps sidebar at ${width}px`); } else assert.ok(metrics.app.left < 2, `compact content offset at ${width}px`);
      assert.equal(metrics.columns, width <= 900 ? (width <= 600 ? 1 : 2) : 3, `business grid invalid at ${width}px`); results.push({ width, columns: metrics.columns, overflow: metrics.overflow, dark: metrics.dark });
    }

    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 1100, deviceScaleFactor: 1, mobile: false });
    await evaluate(cdp, `document.querySelector('[data-business-support]').click()`); assert.equal(await until(cdp, `Boolean(document.querySelector('#supportRequestForm option[value="billing"]'))`), true, 'commercial support categories were not integrated');
    await evaluate(cdp, `window.KLEARN_APP.setView('billing-center')`); assert.equal(await until(cdp, `Boolean(document.getElementById('couponForm'))`), true, 'billing center missing');
    assert.equal(await evaluate(cdp, `document.body.textContent.includes('Không có nút nào trên trang này tự đổi tài khoản thành Premium')`), true, 'payment boundary missing');
    await evaluate(cdp, `document.querySelector('[data-start-checkout]').click()`); await wait(80); assert.equal(await evaluate(cdp, `window.CommercialSubscriptionService.tier()`), 'free', 'client checkout unlocked premium');
    await evaluate(cdp, `window.KLEARN_APP.setView('organization-plans')`); assert.equal(await until(cdp, `document.querySelectorAll('[data-quote-package]').length === 2`), true, 'organization packages missing');
    await evaluate(cdp, `document.querySelector('[data-quote-package="school-license"]').click()`); assert.equal(await evaluate(cdp, `!document.getElementById('quoteForm').classList.contains('hidden')`), true, 'quote form did not open');
    await evaluate(cdp, `(() => { const f=document.getElementById('quoteForm');f.organizationName.value='Trường P39';f.seats.value='120';f.note.value='Cần quản lý lớp';f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));})()`); await wait(80);
    assert.equal(await evaluate(cdp, `localStorage.getItem('klearn_monetization')?.includes('school-license')`), true, 'offline quote draft was not user-scoped');
    await evaluate(cdp, `window.KLEARN_APP.setView('revenue-center')`); await wait(80); assert.equal(await evaluate(cdp, `document.body.textContent.includes('Không có quyền truy cập')`), true, 'student accessed revenue analytics');
    await evaluate(cdp, `window.KLEARN_APP.setView('crm-center')`); await wait(80); assert.equal(await evaluate(cdp, `document.body.textContent.includes('Không có quyền truy cập')`), true, 'student accessed CRM');
    await evaluate(cdp, `(() => { if(window.RolePermissionService) window.RolePermissionService.role=()=> 'admin'; if(window.AccessControlService) window.AccessControlService.role=()=> 'admin'; window.KLEARN_APP.state.monetizationRuntime.revenue=[{currency:'VND',gross_revenue:1000000,net_revenue:900000,refund_amount:0,new_subscriptions:4,canceled_subscriptions:1,coupon_redemptions:2,referral_conversions:1,active_licenses:2}]; window.KLEARN_APP.setView('revenue-center'); })()`); await wait(80);
    assert.equal(await evaluate(cdp, `document.querySelectorAll('.biz-metrics article').length`), 6, 'admin revenue aggregate missing');
    await evaluate(cdp, `(() => { window.KLEARN_APP.state.monetizationRuntime.crm=[{id:'crm-1',account_name:'Trường P39',stage:'qualified',source:'quote'}]; window.KLEARN_APP.setView('crm-center'); })()`); await wait(80);
    assert.equal(await evaluate(cdp, `document.querySelectorAll('.biz-crm-board > article').length`), 5, 'CRM stages missing');
    assert.equal(await evaluate(cdp, `document.documentElement.scrollWidth>document.documentElement.clientWidth`), false, 'business views overflow at 360px');
    console.log(JSON.stringify(results)); console.log('monetization responsive: business hub, subscription boundary, offline quote, admin denial, dark mode and 360-1920 layout passed'); cdp.close();
  } finally { browser.kill(); await wait(200); if (path.resolve(profile).startsWith(path.resolve(os.tmpdir()))) fs.rmSync(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 }); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
