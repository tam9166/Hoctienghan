/* Real-browser P38 QA: node tests/community-ecosystem-responsive.browser.js [url] */
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const edge = [path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')].find((candidate) => candidate && fs.existsSync(candidate));
if (!edge) throw new Error('Microsoft Edge is required for responsive browser QA.');
const baseUrl = process.argv[2] || 'http://127.0.0.1:4173/'; const port = 10600 + Math.floor(Math.random() * 70); const profile = path.join(os.tmpdir(), `klearn-p38-browser-${process.pid}`);
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
    const timestamp = new Date().toISOString(); const user = { id: 'p38-qa', fullName: 'P38 Learner', email: 'p38@local.test', level: 'TOPIK 1', currentTopikLevel: 1, onboardingCompleted: true, createdAt: timestamp };
    await evaluate(cdp, `(() => { localStorage.setItem('klearn_users', ${JSON.stringify(JSON.stringify([user]))}); localStorage.setItem('klearn_session', ${JSON.stringify(JSON.stringify({ userId: user.id, createdAt: timestamp }))}); localStorage.setItem('klearn_progress', ${JSON.stringify(JSON.stringify({ [user.id]: { skills: {}, stats: { streak: 2 }, lessonProgress: {}, daily: { date: timestamp.slice(0,10), tasks: {} } } }))}); localStorage.setItem('klearn_settings', ${JSON.stringify(JSON.stringify({ users: { [user.id]: { theme: 'dark', language: 'vi' } } }))}); location.hash='learning-community'; location.reload(); })()`);
    assert.equal(await until(cdp, `Boolean(window.KoreanLearningCommunity && document.querySelector('[data-p38-hub]'))`), true, 'P38 Community Hub entry did not render');
    assert.equal(await evaluate(cdp, `window.CommunityPrivacyControlsService.get().discoveryEnabled`), false, 'community discovery must default off');
    await evaluate(cdp, `document.querySelector('[data-p38-hub]').click()`); assert.equal(await until(cdp, `Boolean(document.getElementById('languageExchangeForm'))`), true, 'Language Exchange did not render');

    const results = [];
    for (const width of [360, 768, 1024, 1440, 1920]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 1050, deviceScaleFactor: 1, mobile: false }); await wait(100);
      const metrics = await evaluate(cdp, `(() => { const app=document.getElementById('app'), nav=document.getElementById('bottomNav'), layout=document.querySelector('.exchange-layout'); const rect=(node)=>{const r=node?.getBoundingClientRect();return r?{left:r.left,width:r.width,right:r.right}:null}; return {dark:document.documentElement.dataset.theme==='dark',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,bodyOverflow:document.body.scrollWidth>document.body.clientWidth,app:rect(app),nav:rect(nav),columns:layout?getComputedStyle(layout).gridTemplateColumns.split(' ').length:0,minTouch:Math.min(...[...document.querySelectorAll('.exchange-layout button,.exchange-layout input:not([type="checkbox"]),.exchange-layout select')].map((node)=>node.getBoundingClientRect().height))};})()`);
      assert.equal(metrics.dark, true, `dark mode missing at ${width}px`); assert.equal(metrics.overflow, false, `html overflow at ${width}px`); assert.equal(metrics.bodyOverflow, false, `body overflow at ${width}px`); assert.ok(metrics.minTouch >= 40, `touch target too small at ${width}px`);
      if (width >= 1024) { assert.ok(metrics.nav.width >= 240 && metrics.nav.width <= 280, `sidebar invalid at ${width}px`); assert.ok(metrics.app.left >= 240, `content overlaps sidebar at ${width}px`); } else assert.ok(metrics.app.left < 2, `compact content offset at ${width}px`);
      assert.equal(metrics.columns, width > 900 ? 2 : 1, `exchange layout invalid at ${width}px`); results.push({ width, columns: metrics.columns, overflow: metrics.overflow, dark: metrics.dark });
    }

    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 1100, deviceScaleFactor: 1, mobile: false });
    await evaluate(cdp, `(() => { const form=document.getElementById('languageExchangeForm'); form.enabled.checked=true; form.allowRequests.checked=true; form.nativeLanguage.value='vi'; form.learningLanguage.value='ko'; form.topic.value='daily-life'; form.format.value='text-prompts'; form.availability.value='evening'; form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})); })()`);
    assert.equal(await until(cdp, `document.querySelectorAll('[data-exchange-request]').length > 0`), true, 'matching profiles did not render after opt-in');
    await evaluate(cdp, `document.querySelector('[data-exchange-request="peer-hana"]').click()`); await wait(80);
    const exchange = await evaluate(cdp, `(() => { const p=window.LanguageExchangeService.preference(),r=window.LanguageExchangeService.requests()[0]; return {enabled:p.enabled,requestStatus:r.status,contactShared:r.contactShared,matchCount:window.LanguageExchangeService.matches().length};})()`);
    assert.equal(exchange.enabled, true); assert.equal(exchange.requestStatus, 'local-draft'); assert.equal(exchange.contactShared, false); assert.ok(exchange.matchCount >= 2);
    await evaluate(cdp, `window.CommunitySafetyService.block('peer-hana')`);
    assert.equal(await evaluate(cdp, `window.LanguageExchangeService.matches().some(item=>item.id==='peer-hana')`), false, 'blocked peer remains discoverable');
    assert.equal(await evaluate(cdp, `window.LanguageExchangeService.requests()[0].status`), 'cancelled', 'blocked peer request was not cancelled');

    await evaluate(cdp, `window.KLEARN_APP.setView('community-profile')`); assert.equal(await until(cdp, `Boolean(document.querySelector('[data-community-privacy-controls]'))`), true, 'privacy controls did not render');
    assert.equal(await evaluate(cdp, `document.querySelectorAll('[data-community-privacy]').length`), 4, 'privacy controls incomplete');
    await evaluate(cdp, `window.CommunitySafetyService.report({targetType:'profile',targetId:'peer-yun',reason:'spam',details:'Nội dung lặp lại.'}); window.KLEARN_APP.setView('community-moderation')`); await wait(80);
    assert.equal(await evaluate(cdp, `Boolean(document.querySelector('.empty-state')) && document.body.textContent.includes('Chỉ Admin')`), true, 'student moderation access was not denied');
    await evaluate(cdp, `(() => { window.RolePermissionService.role=()=> 'admin'; window.AccessControlService.role=()=> 'admin'; window.KLEARN_APP.setView('community-moderation'); })()`);
    assert.equal(await until(cdp, `Boolean(document.querySelector('[data-moderate*="resolved"]'))`), true, 'admin moderation queue did not render');
    await evaluate(cdp, `document.querySelector('[data-moderate*="resolved"]').click()`); assert.equal(await until(cdp, `window.CommunityModerationService.localActions().length===1`), true, 'moderation action was not audited');
    assert.equal(await evaluate(cdp, `window.CommunityModerationService.localActions()[0].hardDelete`), false, 'moderation performed a hard delete');
    assert.equal(await evaluate(cdp, `document.documentElement.scrollWidth>document.documentElement.clientWidth`), false, 'moderation overflow at 360px');
    console.log(JSON.stringify(results)); console.log('community ecosystem responsive: hub, language exchange opt-in/matching, privacy, block/cancel, moderation RBAC/audit and 360-1920 layout passed'); cdp.close();
  } finally { browser.kill(); await wait(200); if (path.resolve(profile).startsWith(path.resolve(os.tmpdir()))) fs.rmSync(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 }); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
