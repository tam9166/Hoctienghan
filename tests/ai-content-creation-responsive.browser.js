/* Real-browser P37 QA: node tests/ai-content-creation-responsive.browser.js [url] */
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const edge = [path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')].find((candidate) => candidate && fs.existsSync(candidate));
if (!edge) throw new Error('Microsoft Edge is required for responsive browser QA.');
const baseUrl = process.argv[2] || 'http://127.0.0.1:4173/';
const port = 10520 + Math.floor(Math.random() * 70);
const profile = path.join(os.tmpdir(), `klearn-p37-browser-${process.pid}`);
const browser = childProcess.spawn(edge, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--disable-gpu', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore', windowsHide: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function json(url, options) { const response = await fetch(url, options); if (!response.ok) throw new Error(`${response.status} ${url}`); return response.json(); }
async function connect(url) { const socket = new WebSocket(url); let id = 0; const pending = new Map(); await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; }); socket.onmessage = (event) => { const message = JSON.parse(event.data); const request = pending.get(message.id); if (!request) return; pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); }; return { send(method, params = {}) { return new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })); }); }, close() { socket.close(); } }; }
async function evaluate(cdp, expression) { const output = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (output.exceptionDetails) throw new Error(output.exceptionDetails.exception?.description || output.exceptionDetails.text); return output.result.value; }
async function until(cdp, expression, attempts = 100) { for (let attempt = 0; attempt < attempts; attempt += 1) { if (await evaluate(cdp, expression)) return true; await wait(100); } return false; }

(async () => {
  try {
    let version;
    for (let attempt = 0; attempt < 50 && !version; attempt += 1) { try { version = await json(`http://127.0.0.1:${port}/json/version`); } catch (_) { await wait(100); } }
    if (!version) throw new Error('Could not start Edge.');
    const target = await json(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`, { method: 'PUT' });
    const cdp = await connect(target.webSocketDebuggerUrl); await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    assert.equal(await until(cdp, `location.origin !== 'null' && document.readyState === 'complete'`), true, 'page did not load');
    const timestamp = new Date().toISOString(); const user = { id: 'p37-qa', fullName: 'P37 Editor', email: 'p37@local.test', level: 'TOPIK I', onboardingCompleted: true, createdAt: timestamp };
    await evaluate(cdp, `(() => { localStorage.setItem('klearn_users', ${JSON.stringify(JSON.stringify([user]))}); localStorage.setItem('klearn_session', ${JSON.stringify(JSON.stringify({ userId: user.id, createdAt: timestamp }))}); localStorage.setItem('klearn_settings', ${JSON.stringify(JSON.stringify({ users: { [user.id]: { theme: 'dark', language: 'vi' } } }))}); location.hash='home'; location.reload(); })()`);
    assert.equal(await until(cdp, `Boolean(window.AIContentCreationPlatform && window.KLEARN_APP?.state?.currentUser)`), true, 'P37 platform did not load');

    await evaluate(cdp, `(() => { window.RolePermissionService.role=()=> 'student'; window.AccessControlService.role=()=> 'student'; window.KLEARN_APP.setView('ai-content-studio'); })()`); await wait(100);
    assert.equal(await evaluate(cdp, `Boolean(document.querySelector('.ai-content-denied'))`), true, 'student access was not denied');

    await evaluate(cdp, `(() => { window.RolePermissionService.role=()=> 'admin'; window.AccessControlService.role=()=> 'admin'; window.KLEARN_APP.setView('profile'); })()`);
    assert.equal(await until(cdp, `Boolean(document.querySelector('[data-ai-studio-entry] [data-view="ai-content-studio"]'))`), true, 'staff studio entry did not render');
    await evaluate(cdp, `document.querySelector('[data-ai-studio-entry] [data-view="ai-content-studio"]').click()`);
    assert.equal(await until(cdp, `Boolean(document.querySelector('#aiContentForm'))`), true, 'admin studio did not render');
    assert.equal(await evaluate(cdp, `document.body.textContent.includes('Không tự quyết định curriculum') && document.body.textContent.includes('Human approval required')`), true, 'human guard disclosure missing');

    const results = [];
    for (const width of [360, 768, 1024, 1440, 1920]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 1100, deviceScaleFactor: 1, mobile: false }); await wait(100);
      const metrics = await evaluate(cdp, `(() => { const app=document.getElementById('app'), nav=document.getElementById('bottomNav'), panel=document.querySelector('.ai-studio-grid'); const rect=(node)=>{const r=node?.getBoundingClientRect(); return r?{left:r.left,width:r.width,right:r.right}:null}; return { dark:document.documentElement.dataset.theme==='dark', htmlOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth, bodyOverflow:document.body.scrollWidth>document.body.clientWidth, app:rect(app), nav:rect(nav), columns:panel?getComputedStyle(panel).gridTemplateColumns.split(' ').length:0, minButton:Math.min(...[...document.querySelectorAll('.ai-content-studio button')].map((node)=>node.getBoundingClientRect().height)) }; })()`);
      assert.equal(metrics.dark, true, `dark mode missing at ${width}px`); assert.equal(metrics.htmlOverflow, false, `html overflow at ${width}px`); assert.equal(metrics.bodyOverflow, false, `body overflow at ${width}px`); assert.ok(metrics.minButton >= 40, `touch target too small at ${width}px`);
      if (width >= 1024) { assert.ok(metrics.nav.width >= 240 && metrics.nav.width <= 280, `sidebar invalid at ${width}px`); assert.ok(metrics.app.left >= 240, `content overlaps sidebar at ${width}px`); }
      else assert.ok(metrics.app.left < 2, `mobile/tablet content offset at ${width}px`);
      assert.equal(metrics.columns, width > 900 ? 2 : 1, `studio columns invalid at ${width}px`); results.push({ width, columns: metrics.columns, overflow: metrics.htmlOverflow, dark: metrics.dark });
    }

    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 1100, deviceScaleFactor: 1, mobile: false });
    await evaluate(cdp, `(() => { const form=document.getElementById('aiContentForm'); form.elements.topic.value='은/는'; form.elements.objective.value='Dùng trợ từ chủ đề trong câu đơn giản'; form.elements.sourceIds.value='grammar-topic-particle'; document.querySelector('[data-ai-generate="lesson"]').click(); })()`);
    assert.equal(await until(cdp, `window.AIContentDraftRepository.all().length > 0 && !document.querySelector('[data-ai-generate="lesson"]').disabled`, 160), true, 'draft generation did not finish');
    const draft = await evaluate(cdp, `(() => { const d=window.AIContentDraftRepository.all()[0]; return {status:d.status,humanApproved:d.humanApproved,published:d.published,sourceCount:d.sourceIds.length,history:d.history.length}; })()`);
    assert.deepEqual(draft, { status: 'ai_draft', humanApproved: false, published: false, sourceCount: 1, history: 1 });
    assert.equal(await evaluate(cdp, `document.body.textContent.includes('Auto publish') && document.body.textContent.includes('Không')`), true, 'auto-publish guard missing');
    console.log(JSON.stringify(results)); console.log('AI content creation responsive: RBAC, 360/768/1024/1440/1920, dark mode, no overflow, safe draft and human approval disclosure passed'); cdp.close();
  } finally { browser.kill(); await wait(200); if (path.resolve(profile).startsWith(path.resolve(os.tmpdir()))) fs.rmSync(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 }); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
