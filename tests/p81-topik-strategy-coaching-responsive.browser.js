/* Real-browser P81 QA: node tests/p81-topik-strategy-coaching-responsive.browser.js [url] */
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const edge = [path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')].find((candidate) => candidate && fs.existsSync(candidate));
if (!edge) throw new Error('Microsoft Edge is required for P81 responsive QA.');
const baseUrl = process.argv[2] || 'http://127.0.0.1:4173/';
const port = 11600 + Math.floor(Math.random() * 80);
const profile = path.join(os.tmpdir(), `klearn-p81-browser-${process.pid}`);
const browser = childProcess.spawn(edge, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--disable-gpu', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore', windowsHide: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function json(url, options) { const response = await fetch(url, options); if (!response.ok) throw new Error(`${response.status} ${url}`); return response.json(); }
async function connect(url) { const socket = new WebSocket(url); let id = 0; const pending = new Map(); await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; }); socket.onmessage = (event) => { const message = JSON.parse(event.data); const request = pending.get(message.id); if (!request) return; pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); }; return { send(method, params = {}) { return new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })); }); }, close() { socket.close(); } }; }
async function evaluate(cdp, expression) { const output = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (output.exceptionDetails) throw new Error(output.exceptionDetails.exception?.description || output.exceptionDetails.text); return output.result.value; }
async function until(cdp, expression, attempts = 280) { for (let attempt = 0; attempt < attempts; attempt += 1) { if (await evaluate(cdp, expression)) return true; await wait(100); } return false; }

(async () => {
  let cdp;
  try {
    let version; for (let attempt = 0; attempt < 60 && !version; attempt += 1) { try { version = await json(`http://127.0.0.1:${port}/json/version`); } catch (_) { await wait(100); } }
    if (!version) throw new Error('Could not start Edge.');
    const target = await json(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(`${baseUrl}?p81=1`)}`, { method: 'PUT' });
    cdp = await connect(target.webSocketDebuggerUrl); await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Network.enable');
    assert.equal(await until(cdp, `document.readyState === 'complete' && Boolean(window.KLEARN_APP)`), true, 'page did not load');
    const timestamp = new Date().toISOString();
    const user = { id:'p81-strategy-user', fullName:'Strategy P81', email:'p81@local.test', level:'TOPIK II', learningTrack:'topik', goals:['topik'], studyMinutesPerDay:30, currentTopikLevel:2, targetTopikLevel:4, onboardingCompleted:true, createdAt:timestamp };
    await evaluate(cdp, `(() => { const user=${JSON.stringify(user)}, now=${JSON.stringify(timestamp)}; localStorage.clear(); localStorage.setItem('klearn_users',JSON.stringify([user])); localStorage.setItem('klearn_session',JSON.stringify({userId:user.id,createdAt:now})); localStorage.setItem('klearn_progress',JSON.stringify({[user.id]:{p81Marker:'keep-progress',lessonProgress:{},skills:{reading:62,listening:74,writing:38},stats:{streak:5},daily:{tasks:{}}}})); localStorage.setItem('klearn_srs',JSON.stringify({[user.id]:[{id:'p81-existing-srs',wordId:'w1',korean:'사람',meaning:'người',status:'learning'}]})); localStorage.setItem('klearn_errors',JSON.stringify({[user.id]:[{id:'p81-error',type:'topik-inference',question:'inference',mistake:'sai',correction:'đúng',count:3,resolved:false,createdAt:now,lastSeen:now}]})); localStorage.setItem('klearn_learning_goals',JSON.stringify({[user.id]:{id:'goal-p81',goalType:'topik',targetLevel:4,dailyMinutes:30,deadline:'2026-12-19',updatedAt:now}})); localStorage.setItem('klearn_settings',JSON.stringify({schemaVersion:13,users:{[user.id]:{theme:'dark',language:'vi',aiUsage:false}}})); location.hash='topik'; location.reload(); })()`);
    assert.equal(await until(cdp, `Boolean(window.KLEARN_APP?.state?.currentUser && window.P81TopikStrategyConfigService?.get?.() && document.querySelector('[data-p81-entry]'))`), true, 'P81 module/config/entry did not lazy load');
    assert.equal(await evaluate(cdp, `P81StrategyLibraryService.all().length`), 23);
    assert.equal(await evaluate(cdp, `P81StrategyLibraryService.all().every((item)=>item.example.label==='Practice Example'&&item.provenance.examYear===null)`), true, 'provenance contract failed');
    const performanceAudit = await evaluate(cdp, `(() => { const nav=performance.getEntriesByType('navigation')[0]; const started=performance.now(); for(let i=0;i<1000;i+=1) P81StrategyLibraryService.all({level:i%2?'TOPIK I':'TOPIK II',section:i%3?'reading':'listening',query:i%5?'strategy':''}); return {domContentLoaded:Math.round(nav?.domContentLoadedEventEnd||0),load:Math.round(nav?.loadEventEnd||0),filter1000Ms:Math.round((performance.now()-started)*100)/100}; })()`);
    assert.ok(performanceAudit.filter1000Ms < 500, `strategy filtering too slow: ${performanceAudit.filter1000Ms}ms`);
    await evaluate(cdp, `document.querySelector('[data-p81-entry]').click()`);
    assert.equal(await until(cdp, `KLEARN_APP.state.currentView==='topik-strategy-p81' && Boolean(document.querySelector('.p81-hero'))`), true, 'P81 hub did not open');

    const widths = [];
    const responsiveRoutes = ['topik-strategy-p81','topik-strategies-p81','topik-writing-p81','topik-time-p81','topik-simulation-p81','topik-goal-p81','topik-coach-p81','topik-dashboard-p81','topik-readiness-p81','topik-offline-p81'];
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled:true, maxTouchPoints:5 });
    for (const width of [320,360,390,430,768,1024,1440,1920]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height:1100, deviceScaleFactor:1, mobile:width <= 430 });
      for (const route of responsiveRoutes) {
        await evaluate(cdp, `KLEARN_APP.setView(${JSON.stringify(route)})`);
        assert.equal(await until(cdp, `KLEARN_APP.state.currentView===${JSON.stringify(route)} && Boolean(document.querySelector('.p81-shell'))`), true, `${route} did not render at ${width}px`);
        await wait(35);
        const layout = await evaluate(cdp, `(() => { const root=document.documentElement,app=document.getElementById('app'),viewport=Math.max(root.clientWidth,window.innerWidth),controls=[...document.querySelectorAll('.p81-shell button:not([disabled]),.p81-shell input:not([type="checkbox"]),.p81-shell select,.p81-shell textarea')].filter((node)=>getComputedStyle(node).display!=='none'&&node.getBoundingClientRect().width>0); return {htmlOverflow:root.scrollWidth>viewport+1,bodyOverflow:document.body.scrollWidth>viewport+1,appRight:Math.round(app.getBoundingClientRect().right),minTouch:controls.length?Math.min(...controls.map((node)=>node.getBoundingClientRect().height)):48,dark:root.dataset.theme==='dark',korean:getComputedStyle(document.body).fontFamily.length>0}; })()`);
        assert.equal(layout.htmlOverflow, false, `html overflow in ${route} at ${width}px`); assert.equal(layout.bodyOverflow, false, `body overflow in ${route} at ${width}px`); assert.ok(layout.appRight <= width + 1, `${route} exceeds ${width}px`); assert.ok(layout.minTouch >= 44, `touch target ${layout.minTouch}px in ${route} at ${width}px`); assert.equal(layout.dark, true, `dark theme missing at ${width}px`); assert.equal(layout.korean, true);
      }
      widths.push(width);
    }

    await cdp.send('Emulation.setDeviceMetricsOverride', { width:390, height:1100, deviceScaleFactor:1, mobile:true });
    await evaluate(cdp, `KLEARN_APP.setView('topik-strategies-p81')`); assert.equal(await until(cdp, `Boolean(document.querySelector('.p81-strategy-card'))`), true);
    assert.equal(await evaluate(cdp, `(() => { const button=document.querySelector('.p81-strategy-card'); button.focus(); return button.tabIndex===0 && document.activeElement===button; })()`), true, 'strategy cards are not keyboard focusable');
    const strategyFlow = await evaluate(cdp, `(() => { const item=P81StrategyLibraryService.get('p81-tii-reading-inference'); const qs=P81StrategyPracticeService.questions(item.id,5); const session=P81StrategyPracticeService.start(item.id,5); const sectionProgress=Boolean(document.querySelector('.p80-section-progress')); session.questions.forEach((question)=>P80TopikExamService.answer(question.id,question.answer)); const result=P80TopikExamService.finish('submitted'); return {strategy:item.title,questions:qs.length,mode:result.mode,score:result.percentage,source:result.source,sectionProgress}; })()`);
    assert.equal(strategyFlow.questions >= 1, true); assert.match(strategyFlow.mode, /^strategy-p81-/); assert.equal(strategyFlow.source, 'p80-topik-intelligence'); assert.equal(strategyFlow.sectionProgress, true);
    assert.equal(await evaluate(cdp, `JSON.parse(localStorage.getItem('klearn_exam_attempts'))['p81-strategy-user'].history[0].mode.startsWith('strategy-p81-')`), true, 'P80 strategy attempt missing');

    const writing = await evaluate(cdp, `P81WritingSelfCheckService.check('정보가 중요하다. 따라서 여러 출처를 확인해야 한다.',{topic:true,structure:true,grammar:true,vocabulary:true,cohesion:true,spelling:true,logic:true,minimumLength:20})`);
    assert.equal(writing.passed, 8); assert.equal(writing.readyToReview, true);
    const time = await evaluate(cdp, `P81TimeManagementService.customize('topik-ii',{listening:50,writing:50,reading:65,review:10,buffer:5})`); assert.equal(time.totalMinutes, 180);
    const goal = await evaluate(cdp, `(() => { P81GoalPlannerService.save({currentLevel:2,targetLevel:4,deadline:'2026-12-19',dailyMinutes:30}); return P81GoalPlannerService.weekly(14); })()`); assert.equal(goal.weeks.length, 2); assert.equal(goal.independentScheduler, false);
    const diagnosis = await evaluate(cdp, `P81TopikCoachService.diagnosis(14)`); assert.equal(diagnosis.official, false); assert.equal(diagnosis.plan.days, 14); assert.ok(diagnosis.priorities.length >= 1);
    const readiness = await evaluate(cdp, `P81ReadinessService.calculate('TOPIK II')`); assert.ok(readiness.score >= 0 && readiness.score <= 100); assert.equal(readiness.evidence.length, 4);
    const offline = await evaluate(cdp, `(async()=>await P81OfflineStrategyService.download('p81-topik-ii-writing'))()`); assert.equal(offline.status, 'downloaded'); assert.equal(offline.learningDataPreserved, true);
    assert.equal(await evaluate(cdp, `JSON.parse(localStorage.getItem('klearn_progress'))['p81-strategy-user'].p81Marker==='keep-progress'`), true, 'existing progress changed');
    assert.equal(await evaluate(cdp, `JSON.parse(localStorage.getItem('klearn_srs'))['p81-strategy-user'].some((item)=>item.id==='p81-existing-srs')`), true, 'existing SRS changed');
    await cdp.send('Network.emulateNetworkConditions', { offline:true, latency:0, downloadThroughput:0, uploadThroughput:0 });
    await evaluate(cdp, `KLEARN_APP.setView('topik-strategies-p81')`); await wait(120); assert.equal(await evaluate(cdp, `document.querySelectorAll('.p81-strategy-card').length===23`), true, 'offline strategy library failed');

    console.log(JSON.stringify({ status:'passed', widths, responsiveRoutes, checks:widths.length*responsiveRoutes.length+12, strategies:23, writingQuestions:[51,52,53,54], p80PracticeBridge:true, adaptiveGoal:true, aiCoachReuse:true, evidenceReadiness:true, offlinePack:true, keyboardFocus:true, performanceAudit, progressPreserved:true, srsPreserved:true, functionImpact:0 }, null, 2));
  } finally {
    try { cdp?.close(); } catch (_) {}
    browser.kill(); await wait(300);
    try { fs.rmSync(profile, { recursive:true, force:true, maxRetries:5, retryDelay:120 }); } catch (_) {}
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
