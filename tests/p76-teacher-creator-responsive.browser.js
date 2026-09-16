/* Real-browser P76 QA: node tests/p76-teacher-creator-responsive.browser.js [url] */
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const edge = [path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')].find((candidate) => candidate && fs.existsSync(candidate));
if (!edge) throw new Error('Microsoft Edge is required for responsive browser QA.');
const baseUrl = process.argv[2] || 'http://127.0.0.1:4173/';
const port = 11100 + Math.floor(Math.random() * 70);
const profile = path.join(os.tmpdir(), `klearn-p76-browser-${process.pid}`);
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
    const target = await json(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(`${baseUrl}?p76=1`)}`, { method: 'PUT' });
    cdp = await connect(target.webSocketDebuggerUrl); await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    assert.equal(await until(cdp, `location.origin !== 'null' && document.readyState === 'complete'`), true, 'page did not load');
    const timestamp = new Date().toISOString();
    const user = { id: 'p76-creator', fullName: 'Creator P76', email: 'creator@local.test', level: 'TOPIK 1', learningTrack: 'topik', goals: ['topik'], studyMinutesPerDay: 15, currentTopikLevel: 1, onboardingCompleted: true, createdAt: timestamp };
    await evaluate(cdp, `(() => { const user=${JSON.stringify(user)}; localStorage.clear(); localStorage.setItem('klearn_users',JSON.stringify([user])); localStorage.setItem('klearn_session',JSON.stringify({userId:user.id,createdAt:${JSON.stringify(timestamp)}})); localStorage.setItem('klearn_progress',JSON.stringify({[user.id]:{p76Marker:'keep-progress',lessonProgress:{legacy:{completed:true,score:86}},daily:{}}})); localStorage.setItem('klearn_srs',JSON.stringify({[user.id]:[{id:'existing-srs',state:'learning'}]})); localStorage.setItem('klearn_settings',JSON.stringify({users:{[user.id]:{theme:'dark',language:'vi'}}})); location.hash='home'; location.reload(); })()`);
    assert.equal(await until(cdp, `Boolean(window.KLEARN_APP?.state?.currentUser && document.querySelector('[data-p74-home]'))`), true, 'authenticated Home did not load');
    await evaluate(cdp, `window.SupabaseService={session:{user:{id:'p76-creator',app_metadata:{role:'content_creator',content_scopes:['*']}}}}; KLEARN_APP.setView('teacher-creator-ecosystem')`);
    assert.equal(await until(cdp, `Boolean(window.TeacherCreatorEcosystem && document.querySelector('[data-p76-hub]'))`), true, 'P76 hub did not render');
    assert.equal(await evaluate(cdp, `TeacherCreatorRoleService.role()`), 'creator');
    assert.equal(await evaluate(cdp, `document.querySelectorAll('.p76-launch > button').length`), 4, 'creator actions are not role-scoped');

    const widths = [];
    for (const width of [360, 390, 430, 768, 1024, 1440, 1920]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 1100, deviceScaleFactor: 1, mobile: width <= 430 }); await wait(100);
      const result = await evaluate(cdp, `(() => { const root=document.documentElement, app=document.getElementById('app'), grid=document.querySelector('.p76-launch'); const buttons=[...grid.querySelectorAll('button')]; return {width:innerWidth,dark:root.dataset.theme==='dark',htmlOverflow:root.scrollWidth>root.clientWidth,bodyOverflow:document.body.scrollWidth>document.body.clientWidth,appRight:Math.round(app.getBoundingClientRect().right),columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length,minTouch:Math.min(...buttons.map((item)=>item.getBoundingClientRect().height))}; })()`);
      assert.equal(result.dark, true, `dark mode missing at ${width}px`);
      assert.equal(result.htmlOverflow, false, `html overflow at ${width}px`);
      assert.equal(result.bodyOverflow, false, `body overflow at ${width}px`);
      assert.ok(result.appRight <= width + 1, `app exceeds ${width}px viewport`);
      assert.equal(result.columns, width <= 560 ? 1 : width <= 1023 ? 2 : 4, `columns invalid at ${width}px`);
      assert.ok(result.minTouch >= 44, `touch target below 44px at ${width}px`);
      widths.push({ width, columns: result.columns, overflow: false });
    }

    await evaluate(cdp, `KLEARN_APP.setView('creator-studio-p76')`);
    assert.equal(await until(cdp, `Boolean(document.querySelector('[data-p76-content]'))`), true, 'Creator Studio missing');
    const createdId = await evaluate(cdp, `CreatorDraftService.create({type:'grammar',title:'Browser P76',level:'TOPIK 1',skill:'grammar',objective:'Hiểu trợ từ cơ bản',explanation:'Giải thích đủ dài cho automated quality check.',example:'저는 학생이에요.',exercise:'Chọn trợ từ đúng.'}).id`);
    assert.ok(createdId);
    assert.equal(await evaluate(cdp, `CreatorReviewWorkflowService.automatedCheck(${JSON.stringify(createdId)}).automatedCheckPassed`), true, 'automated check failed');
    assert.equal(await evaluate(cdp, `CreatorReviewWorkflowService.submit(${JSON.stringify(createdId)}).status`), 'pending_review', 'submit review failed');
    assert.equal(await evaluate(cdp, `JSON.parse(localStorage.getItem('klearn_progress'))['p76-creator'].p76Marker`), 'keep-progress', 'progress changed');
    assert.equal(await evaluate(cdp, `JSON.parse(localStorage.getItem('klearn_srs'))['p76-creator'][0].id`), 'existing-srs', 'SRS changed');
    await evaluate(cdp, `location.reload()`);
    assert.equal(await until(cdp, `Boolean(window.KLEARN_APP?.state?.currentUser)`), true, 'reload lost current user');
    await evaluate(cdp, `window.SupabaseService={session:{user:{id:'p76-creator',app_metadata:{role:'content_creator',content_scopes:['*']}}}}; KLEARN_APP.setView('creator-studio-p76')`);
    assert.equal(await until(cdp, `Boolean(window.CreatorDraftService && document.querySelector('[data-p76-content]'))`), true, 'P76 did not resume after reload');
    assert.equal(await evaluate(cdp, `CreatorDraftService.all().some(item=>item.id===${JSON.stringify(createdId)}&&item.status==='pending_review')`), true, 'draft workflow was not persisted');
    console.log(JSON.stringify({ status: 'passed', widths, dark: true, role: 'creator', workflowPersisted: true, progressPreserved: true, srsPreserved: true }, null, 2));
  } finally {
    try { cdp?.close(); } catch (_) {}
    browser.kill(); await wait(300);
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 120 }); } catch (_) {}
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
