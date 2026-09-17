/* Real-browser P77 QA: node tests/p77-premium-monetization-responsive.browser.js [url] */
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const edge = [path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')].find((candidate) => candidate && fs.existsSync(candidate));
if (!edge) throw new Error('Microsoft Edge is required for responsive browser QA.');
const baseUrl = process.argv[2] || 'http://127.0.0.1:4173/';
const port = 11200 + Math.floor(Math.random() * 70);
const profile = path.join(os.tmpdir(), `klearn-p77-browser-${process.pid}`);
const browser = childProcess.spawn(edge, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--disable-gpu', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore', windowsHide: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function json(url, options) { const response = await fetch(url, options); if (!response.ok) throw new Error(`${response.status} ${url}`); return response.json(); }
async function connect(url) { const socket = new WebSocket(url); let id = 0; const pending = new Map(); await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; }); socket.onmessage = (event) => { const message = JSON.parse(event.data); const request = pending.get(message.id); if (!request) return; pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); }; return { send(method, params = {}) { return new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })); }); }, close() { socket.close(); } }; }
async function evaluate(cdp, expression) { const output = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (output.exceptionDetails) throw new Error(output.exceptionDetails.exception?.description || output.exceptionDetails.text); return output.result.value; }
async function until(cdp, expression, attempts = 220) { for (let attempt = 0; attempt < attempts; attempt += 1) { if (await evaluate(cdp, expression)) return true; await wait(100); } return false; }

(async () => {
  let cdp;
  try {
    let version; for (let attempt = 0; attempt < 60 && !version; attempt += 1) { try { version = await json(`http://127.0.0.1:${port}/json/version`); } catch (_) { await wait(100); } }
    if (!version) throw new Error('Could not start Edge.');
    const target = await json(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(`${baseUrl}?p77=1`)}`, { method: 'PUT' });
    cdp = await connect(target.webSocketDebuggerUrl); await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    assert.equal(await until(cdp, `location.origin !== 'null' && document.readyState === 'complete'`), true, 'page did not load');
    const timestamp = new Date().toISOString();
    const user = { id: 'p77-creator', fullName: 'Creator P77', email: 'creator@local.test', level: 'TOPIK 1', learningTrack: 'topik', goals: ['topik'], studyMinutesPerDay: 15, currentTopikLevel: 1, onboardingCompleted: true, createdAt: timestamp };
    await evaluate(cdp, `(() => { const user=${JSON.stringify(user)}; localStorage.clear(); localStorage.setItem('klearn_users',JSON.stringify([user])); localStorage.setItem('klearn_session',JSON.stringify({userId:user.id,createdAt:${JSON.stringify(timestamp)}})); localStorage.setItem('klearn_progress',JSON.stringify({[user.id]:{p77Marker:'keep-progress',lessonProgress:{legacy:{completed:true}},daily:{}}})); localStorage.setItem('klearn_srs',JSON.stringify({[user.id]:[{id:'existing-srs',state:'learning'}]})); localStorage.setItem('klearn_settings',JSON.stringify({users:{[user.id]:{theme:'dark',language:'vi'}}})); location.hash='home'; location.reload(); })()`);
    assert.equal(await until(cdp, `Boolean(window.KLEARN_APP?.state?.currentUser && document.querySelector('[data-p74-home]'))`), true, 'authenticated Home did not load');
    await evaluate(cdp, `window.SupabaseService={session:{access_token:'browser-token',user:{id:'p77-creator',app_metadata:{role:'content_creator',content_scopes:['*']}}}}; KLEARN_APP.setView('premium-benefits-p77')`);
    assert.equal(await until(cdp, `Boolean(window.P77SubscriptionService && document.querySelector('.p77-plans'))`), true, 'P77 benefits did not render');
    assert.equal(await evaluate(cdp, `document.querySelectorAll('.p77-plans article').length`), 3, 'plan cards missing');
    assert.equal(await evaluate(cdp, `P77SubscriptionService.current().effectivePlan`), 'free');
    assert.equal(await evaluate(cdp, `BackendEntitlementService.preview({accessLevel:'free'}).allowed && !BackendEntitlementService.preview({accessLevel:'premium'}).allowed`), true, 'Free access boundary failed');

    const widths = [];
    for (const width of [360, 390, 430, 768, 1024, 1440, 1920]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 1200, deviceScaleFactor: 1, mobile: width <= 430 }); await wait(100);
      const result = await evaluate(cdp, `(() => { const root=document.documentElement, app=document.getElementById('app'), grid=document.querySelector('.p77-plans'); const buttons=[...document.querySelectorAll('.p77-shell button:not([disabled])')]; return {width:innerWidth,dark:root.dataset.theme==='dark',htmlOverflow:root.scrollWidth>root.clientWidth,bodyOverflow:document.body.scrollWidth>document.body.clientWidth,appRight:Math.round(app.getBoundingClientRect().right),columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length,minTouch:Math.min(...buttons.map((item)=>item.getBoundingClientRect().height))}; })()`);
      assert.equal(result.dark, true, `dark mode missing at ${width}px`);
      assert.equal(result.htmlOverflow, false, `html overflow at ${width}px`);
      assert.equal(result.bodyOverflow, false, `body overflow at ${width}px`);
      assert.ok(result.appRight <= width + 1, `app exceeds ${width}px viewport`);
      assert.equal(result.columns, width <= 600 ? 1 : width <= 900 ? 2 : 3, `columns invalid at ${width}px`);
      assert.ok(result.minTouch >= 44, `touch target below 44px at ${width}px`);
      widths.push({ width, columns: result.columns, overflow: false });
    }

    await evaluate(cdp, `ServerEntitlementService.acceptServerProjection({plan:'premium',status:'active',end_date:'2099-01-01T00:00:00Z'}); KLEARN_APP.render()`); await wait(80);
    assert.equal(await evaluate(cdp, `P77SubscriptionService.current().effectivePlan==='premium' && P77SubscriptionService.can('advanced_topik') && !P77SubscriptionService.can('student_analytics')`), true, 'Premium features failed');
    await evaluate(cdp, `ServerEntitlementService.acceptServerProjection({plan:'teacher_pro',status:'active',end_date:'2099-01-01T00:00:00Z'}); KLEARN_APP.render()`); await wait(80);
    assert.equal(await evaluate(cdp, `P77SubscriptionService.current().effectivePlan==='teacher_pro' && P77SubscriptionService.can('student_analytics') && P77SubscriptionService.can('course_management')`), true, 'Teacher Pro features failed');
    await evaluate(cdp, `ServerEntitlementService.acceptServerProjection({plan:'premium',status:'expired',end_date:'2020-01-01T00:00:00Z'}); KLEARN_APP.render()`); await wait(80);
    assert.equal(await evaluate(cdp, `P77SubscriptionService.current().effectivePlan==='free' && P77SubscriptionService.can('basic_srs')`), true, 'expired fallback failed');

    const course = { id:'11111111-1111-1111-1111-111111111111', owner_id:'creator-2', title:'TOPIK 5 Browser Course', description:'Khóa học nâng cao có preview.', level:'TOPIK 5', access_level:'premium', price:199000, currency:'VND', revenue_share:70, preview_lesson_id:'22222222-2222-2222-2222-222222222222', sales_count:3 };
    await evaluate(cdp, `PremiumCourseService.hydrate([${JSON.stringify(course)}]); PremiumCourseService.select('${course.id}')`);
    assert.equal(await until(cdp, `Boolean(document.querySelector('.p77-course-landing'))`), true, 'course landing did not render');
    assert.equal(await evaluate(cdp, `document.querySelector('.p77-preview').textContent.includes('Bài học mẫu sẵn sàng') && document.querySelector('.p77-course-landing').textContent.includes('199.000')`), true, 'preview or price missing');
    assert.equal(await evaluate(cdp, `CreatorRevenueFoundationService.estimate({price:199000,revenueShare:70,salesCount:3}).creatorBalance`), 417900, 'creator revenue estimate failed');
    assert.equal(await evaluate(cdp, `JSON.parse(localStorage.getItem('klearn_progress'))['p77-creator'].p77Marker==='keep-progress' && JSON.parse(localStorage.getItem('klearn_srs'))['p77-creator'][0].id==='existing-srs'`), true, 'learning data changed');
    console.log(JSON.stringify({ status: 'passed', widths, dark: true, plans: ['free','premium','teacher_pro'], premiumCoursePreview: true, progressPreserved: true, srsPreserved: true }, null, 2));
  } finally {
    try { cdp?.close(); } catch (_) {}
    browser.kill(); await wait(300);
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 120 }); } catch (_) {}
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
