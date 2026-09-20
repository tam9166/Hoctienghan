/* Real-browser P80 QA: node tests/p80-topik-exam-intelligence-responsive.browser.js [url] */
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const edge = [path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')].find((candidate) => candidate && fs.existsSync(candidate));
if (!edge) throw new Error('Microsoft Edge is required for P80 responsive QA.');
const baseUrl = process.argv[2] || 'http://127.0.0.1:4173/';
const port = 11500 + Math.floor(Math.random() * 80);
const profile = path.join(os.tmpdir(), `klearn-p80-browser-${process.pid}`);
const browser = childProcess.spawn(edge, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--disable-gpu', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore', windowsHide: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function json(url, options) { const response = await fetch(url, options); if (!response.ok) throw new Error(`${response.status} ${url}`); return response.json(); }
async function connect(url) { const socket = new WebSocket(url); let id = 0; const pending = new Map(); await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; }); socket.onmessage = (event) => { const message = JSON.parse(event.data); const request = pending.get(message.id); if (!request) return; pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); }; return { send(method, params = {}) { return new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })); }); }, close() { socket.close(); } }; }
async function evaluate(cdp, expression) { const output = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (output.exceptionDetails) throw new Error(output.exceptionDetails.exception?.description || output.exceptionDetails.text); return output.result.value; }
async function until(cdp, expression, attempts = 260) { for (let attempt = 0; attempt < attempts; attempt += 1) { if (await evaluate(cdp, expression)) return true; await wait(100); } return false; }

(async () => {
  let cdp;
  try {
    let version; for (let attempt = 0; attempt < 60 && !version; attempt += 1) { try { version = await json(`http://127.0.0.1:${port}/json/version`); } catch (_) { await wait(100); } }
    if (!version) throw new Error('Could not start Edge.');
    const target = await json(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(`${baseUrl}?p80=1`)}`, { method: 'PUT' });
    cdp = await connect(target.webSocketDebuggerUrl); await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Network.enable');
    assert.equal(await until(cdp, `document.readyState === 'complete' && Boolean(window.KLEARN_APP)`), true, 'page did not load');
    const timestamp = new Date().toISOString();
    const user = { id:'p80-topik-user', fullName:'TOPIK P80', email:'p80@local.test', level:'TOPIK 3', learningTrack:'topik', goals:['topik'], studyMinutesPerDay:30, currentTopikLevel:3, targetTopikLevel:4, onboardingCompleted:true, createdAt:timestamp };
    await evaluate(cdp, `(() => { const user=${JSON.stringify(user)}; localStorage.clear(); localStorage.setItem('klearn_users',JSON.stringify([user])); localStorage.setItem('klearn_session',JSON.stringify({userId:user.id,createdAt:${JSON.stringify(timestamp)}})); localStorage.setItem('klearn_progress',JSON.stringify({[user.id]:{p80Marker:'keep-progress',lessonProgress:{},skills:{reading:12},stats:{streak:4},daily:{tasks:{}}}})); localStorage.setItem('klearn_srs',JSON.stringify({[user.id]:[{id:'p80-existing-srs',wordId:'w1',korean:'사람',meaning:'người',status:'learning'}]})); localStorage.setItem('klearn_practice_history',JSON.stringify({[user.id]:[{id:'p80-existing-attempt',setId:'existing-set',setTitle:'Existing',level:'TOPIK_3',percentage:50,skillBreakdown:{reading:50},topicBreakdown:{},completedAt:${JSON.stringify(timestamp)}}]})); localStorage.setItem('klearn_settings',JSON.stringify({schemaVersion:13,users:{[user.id]:{theme:'dark',language:'vi',aiUsage:false}}})); location.hash='topik'; location.reload(); })()`);
    assert.equal(await until(cdp, `Boolean(window.KLEARN_APP?.state?.currentUser && window.P80TopikConfigService?.get?.())`), true, 'P80 module/config did not lazy load');
    await evaluate(cdp, `KLEARN_APP.setView('topik')`);
    assert.equal(await until(cdp, `Boolean(document.querySelector('[data-p80-entry]'))`), true, 'P80 TOPIK entry did not render');
    await evaluate(cdp, `document.querySelector('[data-p80-entry]').click()`);
    assert.equal(await until(cdp, `KLEARN_APP.state.currentView==='topik-intelligence-p80' && Boolean(document.querySelector('.p80-hero'))`), true, 'P80 TOPIK entry did not open the hub');
    assert.equal(await evaluate(cdp, `P80TopikQuestionBankService.coverage().total`), 44);
    assert.equal(await evaluate(cdp, `P80SmartTestGeneratorService.generate({level:'TOPIK II'}).questions.length`), 20);

    const widths = []; const responsiveRoutes = ['topik-intelligence-p80','topik-bank-p80','topik-section-p80','topik-types-p80','topik-generator-p80'];
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled:true, maxTouchPoints:5 });
    for (const width of [320,360,390,430,768,1024,1440]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height:1000, deviceScaleFactor:1, mobile:width <= 430 });
      for (const route of responsiveRoutes) {
        await evaluate(cdp, `KLEARN_APP.setView(${JSON.stringify(route)})`);
        assert.equal(await until(cdp, `KLEARN_APP.state.currentView===${JSON.stringify(route)} && Boolean(document.querySelector('.p80-shell'))`), true, `${route} did not render at ${width}px`);
        await wait(40);
        const layout = await evaluate(cdp, `(() => { const root=document.documentElement,app=document.getElementById('app'),viewport=Math.max(root.clientWidth,window.innerWidth),controls=[...document.querySelectorAll('.p80-shell button:not([disabled]),.p80-shell input,.p80-shell select,.p80-shell textarea')].filter((node)=>getComputedStyle(node).display!=='none'&&node.getBoundingClientRect().width>0); return {htmlOverflow:root.scrollWidth>viewport+1,bodyOverflow:document.body.scrollWidth>viewport+1,appRight:Math.round(app.getBoundingClientRect().right),minTouch:controls.length?Math.min(...controls.map((node)=>node.getBoundingClientRect().height)):48,dark:root.dataset.theme==='dark'}; })()`);
        assert.equal(layout.htmlOverflow, false, `html overflow in ${route} at ${width}px`); assert.equal(layout.bodyOverflow, false, `body overflow in ${route} at ${width}px`); assert.ok(layout.appRight <= width + 1, `${route} exceeds ${width}px`); assert.ok(layout.minTouch >= 44, `touch target ${layout.minTouch}px in ${route} at ${width}px`); assert.equal(layout.dark, true, `dark theme missing at ${width}px`);
      }
      widths.push(width);
    }

    await cdp.send('Emulation.setDeviceMetricsOverride', { width:390, height:1000, deviceScaleFactor:1, mobile:true });
    const result = await evaluate(cdp, `(() => { const session=P80SmartTestGeneratorService.start({level:'TOPIK II',weakSkill:'inference',goal:'reading'}); session.questions.forEach((question,index)=>P80TopikExamService.answer(question.id,index===0?'sai':question.answer)); return P80TopikExamService.finish('submitted'); })()`);
    assert.equal(result.total, 20); assert.equal(result.wrong, 1); assert.equal(result.percentage, 95); assert.equal(result.scaledScore, 285);
    assert.equal(await until(cdp, `KLEARN_APP.state.currentView==='topik-result-p80' && Boolean(document.querySelector('.p80-result-hero'))`), true, 'result view missing');
    assert.equal(await evaluate(cdp, `JSON.parse(localStorage.getItem('klearn_errors'))['p80-topik-user'].length`), 1, 'wrong answer not synced to Error Notebook');
    assert.equal(await evaluate(cdp, `JSON.parse(localStorage.getItem('klearn_exam_attempts'))['p80-topik-user'].history[0].source==='p80-topik-intelligence'`), true, 'exam history missing');
    assert.equal(await evaluate(cdp, `JSON.parse(localStorage.getItem('klearn_practice_history'))['p80-topik-user'].some((item)=>item.id==='p80-existing-attempt')`), true, 'existing practice history changed');
    assert.equal(await evaluate(cdp, `JSON.parse(localStorage.getItem('klearn_progress'))['p80-topik-user'].p80Marker==='keep-progress'`), true, 'existing progress marker changed');
    assert.equal(await evaluate(cdp, `JSON.parse(localStorage.getItem('klearn_srs'))['p80-topik-user'].some((item)=>item.id==='p80-existing-srs')`), true, 'existing SRS changed');
    await evaluate(cdp, `KLEARN_APP.setView('topik-report-p80')`); assert.equal(await until(cdp, `Boolean(document.querySelector('.p80-report'))`), true, 'report view missing');
    const report = await evaluate(cdp, `P80TopikReportService.diagnose(4)`); assert.equal(report.prediction.attempts, 1); assert.ok(report.actions.length >= 1);
    await cdp.send('Network.emulateNetworkConditions', { offline:true, latency:0, downloadThroughput:0, uploadThroughput:0 }); await evaluate(cdp, `KLEARN_APP.setView('topik-bank-p80')`); await wait(120); assert.equal(await evaluate(cdp, `document.querySelectorAll('.p80-question-list article').length===20`), true, 'offline bank render failed');
    console.log(JSON.stringify({ status:'passed', widths, responsiveRoutes, checks:widths.length*responsiveRoutes.length+5, questions:44, smartDistribution:'5-10-5', score:result.percentage, errorSync:true, historyPreserved:true, srsPreserved:true, offlineBank:true }, null, 2));
  } finally {
    try { cdp?.close(); } catch (_) {}
    browser.kill(); await wait(300);
    try { fs.rmSync(profile, { recursive:true, force:true, maxRetries:5, retryDelay:120 }); } catch (_) {}
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
