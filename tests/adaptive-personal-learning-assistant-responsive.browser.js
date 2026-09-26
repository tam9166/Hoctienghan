/* Real-browser QA: node tests/adaptive-personal-learning-assistant-responsive.browser.js */
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.join(__dirname, '..');
const edge = [path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')].find((candidate) => candidate && fs.existsSync(candidate));
if (!edge) throw new Error('Microsoft Edge is required for adaptive responsive QA.');
const webPort = 16700 + Math.floor(Math.random() * 100);
const debugPort = 16820 + Math.floor(Math.random() * 100);
const baseUrl = `http://127.0.0.1:${webPort}/`;
const profile = path.join(os.tmpdir(), `klearn-adaptive-browser-${process.pid}`);
const server = cp.spawn('python', ['-m', 'http.server', String(webPort), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore', windowsHide: true });
const browser = cp.spawn(edge, ['--headless=new', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, '--disable-gpu', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore', windowsHide: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function json(url, options) { const response = await fetch(url, options); if (!response.ok) throw new Error(`${response.status} ${url}`); return response.json(); }
async function connect(url) { const socket = new WebSocket(url); let id = 0; const pending = new Map(); await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; }); socket.onmessage = (event) => { const message = JSON.parse(event.data); const request = pending.get(message.id); if (!request) return; pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); }; return { send(method, params = {}) { return new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })); }); }, close() { socket.close(); } }; }
async function evaluate(cdp, expression) { const output = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (output.exceptionDetails) throw new Error(output.exceptionDetails.exception?.description || output.exceptionDetails.text); return output.result.value; }
async function until(cdp, expression, attempts = 250) { for (let index = 0; index < attempts; index += 1) { if (await evaluate(cdp, expression)) return true; await wait(100); } return false; }

(async () => {
  let cdp;
  try {
    let version; for (let attempt = 0; attempt < 80 && !version; attempt += 1) { try { version = await json(`http://127.0.0.1:${debugPort}/json/version`); } catch (_) { await wait(100); } }
    if (!version) throw new Error('Could not start Edge.');
    const target = await json(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(baseUrl)}`, { method: 'PUT' });
    cdp = await connect(target.webSocketDebuggerUrl); await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    assert.equal(await until(cdp, `document.readyState==='complete'&&Boolean(window.KLEARN_APP&&window.AdaptiveLearningEngine&&window.DailyLearningExperienceService)`), true, 'app did not load');
    await evaluate(cdp, `(async()=>{localStorage.clear();const app=KLEARN_APP;await app.auth.register({fullName:'Adaptive Learner',email:'adaptive-${Date.now()}@local.test',password:'Safe-password-2026',skipHydrate:true});app.updateCurrentUser({onboardingCompleted:true,learningTrack:'topik',level:'Beginner',currentTopikLevel:1,targetTopikLevel:3,studyMinutesPerDay:30,goals:['topik']});const p=app.getUserProgress();p.skills={vocabulary:64,grammar:71,listening:48,reading:88,writing:0,speaking:0};p.stats.streak=4;app.saveUserProgress(p);app.saveUserSrs(Array.from({length:23},(_,i)=>({id:'adaptive-card-'+i,wordId:'adaptive-word-'+i,korean:'단어'+i,meaning:'từ '+i,status:'review',nextReview:new Date(Date.now()-86400000).toISOString(),wrongCount:i<3?2:0,mastery:i<3?35:65,createdAt:new Date().toISOString()})));app.saveUserScoped(app.STORAGE_KEYS.errors,Array.from({length:5},(_,i)=>({id:'adaptive-error-'+i,type:'listening',skill:'listening',questionType:'time_place',question:'Nghe '+i,mistake:'3',correction:'4',count:2,repetitionCount:2,resolved:false,createdAt:new Date().toISOString(),lastSeen:new Date().toISOString()})),100);AdaptiveLearningEngine.goals.saveGoal({currentLevel:'Beginner',targetLevel:3,targetMonths:6,dailyMinutes:30,studyDaysPerWeek:6,prioritySkills:['listening','vocabulary']});app.setView('home')})()`);
    const homeReady = await until(cdp, `Boolean(document.querySelector('.bla-adaptive-today')&&document.querySelector('.bla-adaptive-weakness')&&document.querySelector('[data-bla-adaptive-start]'))`);
    if (!homeReady) console.error(await evaluate(cdp, `({view:KLEARN_APP.state.currentView,user:KLEARN_APP.state.currentUser?.id,hasDaily:Boolean(window.DailyLearningExperienceService),hasAdaptive:Boolean(window.AdaptiveLearningEngine),plan:Boolean(document.querySelector('.bla-adaptive-today')),weakness:Boolean(document.querySelector('.bla-adaptive-weakness')),start:Boolean(document.querySelector('[data-bla-adaptive-start]')),text:document.getElementById('app')?.innerText?.slice(0,500)})`));
    assert.equal(homeReady, true, 'adaptive home did not render');
    const plan = await evaluate(cdp, `(()=>{const p=DailyLearningExperienceService.plan.build(30);return{minutes:p.tasks.reduce((s,x)=>s+x.minutes,0),types:p.tasks.map(x=>x.type),reasons:p.tasks.every(x=>Boolean(x.reason))}})()`);
    assert.equal(plan.minutes, 30); assert.equal(plan.types[0], 'srs'); assert.ok(plan.types.includes('listening')); assert.ok(plan.types.includes('repair')); assert.equal(plan.reasons, true);
    const widths = [];
    for (const width of [320, 360, 390, 430, 768, 1024, 1440, 1920]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 1200, deviceScaleFactor: 1, mobile: width <= 430 });
      await evaluate(cdp, `KLEARN_APP.setView('home')`); await wait(80);
      const layout = await evaluate(cdp, `(()=>{const root=document.documentElement,viewport=Math.max(root.clientWidth,innerWidth),start=document.querySelector('[data-bla-adaptive-start]'),plan=document.querySelector('.bla-adaptive-today'),summary=document.querySelector('.bla-adaptive-weakness');return{overflow:root.scrollWidth>viewport+1,bodyOverflow:document.body.scrollWidth>viewport+1,startVisible:Boolean(start&&start.getBoundingClientRect().width>0),planVisible:Boolean(plan&&plan.getBoundingClientRect().width>0),summaryVisible:Boolean(summary&&summary.getBoundingClientRect().width>0),startHeight:start?.getBoundingClientRect().height||0}})()`);
      assert.equal(layout.overflow, false, `html overflow at ${width}px`); assert.equal(layout.bodyOverflow, false, `body overflow at ${width}px`); assert.equal(layout.startVisible, true); assert.equal(layout.planVisible, true); assert.equal(layout.summaryVisible, true); assert.ok(layout.startHeight >= 40, `start target too small at ${width}px`); widths.push(width);
    }
    await evaluate(cdp, `document.querySelector('[data-bla-adaptive-start]').click()`);
    assert.equal(await until(cdp, `KLEARN_APP.state.currentView==='daily-session'&&Boolean(document.querySelector('.daily-session-current'))`), true, 'one-click session did not start');
    const active = await evaluate(cdp, `(()=>{const s=DailyLearningExperienceService.sessions.active();return{source:s.source,minutes:s.tasks.reduce((sum,item)=>sum+item.minutes,0),first:s.tasks[0].type,reason:Boolean(s.tasks[0].reason)}})()`);
    assert.equal(active.source, 'daily-experience'); assert.equal(active.minutes, 30); assert.equal(active.first, 'srs'); assert.equal(active.reason, true);
    console.log(JSON.stringify({ status: 'passed', widths, adaptivePlan: plan.types, oneClickStart: true, totalMinutes: 30 }, null, 2));
  } finally {
    try { cdp?.close(); } catch (_) {}
    browser.kill(); server.kill(); await wait(300);
    try { if (path.resolve(profile).startsWith(path.resolve(os.tmpdir()))) fs.rmSync(profile, { recursive: true, force: true, maxRetries: 6, retryDelay: 100 }); } catch (_) {}
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
