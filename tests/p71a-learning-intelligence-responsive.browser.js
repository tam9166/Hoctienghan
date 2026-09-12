/* Real-browser P71A QA: node tests/p71a-learning-intelligence-responsive.browser.js [url] */
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const edge = [path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')].find((candidate) => candidate && fs.existsSync(candidate));
if (!edge) throw new Error('Microsoft Edge is required for P71A responsive QA.');
const baseUrl = process.argv[2] || 'http://127.0.0.1:4173/';
const port = 11120 + Math.floor(Math.random() * 70);
const profile = path.join(os.tmpdir(), `klearn-p71a-browser-${process.pid}`);
const browser = childProcess.spawn(edge, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--disable-gpu', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore', windowsHide: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function json(url, options) { const response = await fetch(url, options); if (!response.ok) throw new Error(`${response.status} ${url}`); return response.json(); }
async function connect(url) { const socket = new WebSocket(url); let id = 0; const pending = new Map(); await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; }); socket.onmessage = (event) => { const message = JSON.parse(event.data); const request = pending.get(message.id); if (!request) return; pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); }; return { send(method, params = {}) { return new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })); }); }, close() { socket.close(); } }; }
async function evaluate(cdp, expression) { const output = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (output.exceptionDetails) throw new Error(output.exceptionDetails.exception?.description || output.exceptionDetails.text); return output.result.value; }
async function until(cdp, expression, attempts = 160) { for (let attempt = 0; attempt < attempts; attempt += 1) { if (await evaluate(cdp, expression)) return true; await wait(100); } return false; }

(async () => {
  try {
    let version; for (let attempt = 0; attempt < 50 && !version; attempt += 1) { try { version = await json(`http://127.0.0.1:${port}/json/version`); } catch (_) { await wait(100); } }
    if (!version) throw new Error('Could not start Edge.');
    const target = await json(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`, { method: 'PUT' }); const cdp = await connect(target.webSocketDebuggerUrl); await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    assert.equal(await until(cdp, `document.readyState === 'complete'`), true);
    const timestamp = new Date().toISOString();
    const user = { id: 'p71a-browser', fullName: 'Memory Learner', email: 'memory@local.test', currentTopikLevel: 1, targetTopikLevel: 4, studyMinutesPerDay: 25, onboardingCompleted: true, createdAt: timestamp };
    const progress = { p71aRegressionMarker: 'keep-me', foundation: { learnedCharacters: ['ㅏ', 'ㄱ'], updatedAt: timestamp }, lessonProgress: { first: { completed: true, score: 90, updatedAt: timestamp } }, skills: { vocabulary: 78, grammar: 55, listening: 40, reading: 68, speaking: 62, writing: 58, pronunciation: 48 }, stats: { streak: 4 }, pronunciationAttempts: [{ score: 48 }], writingSubmissions: [{ score: 58 }] };
    const srs = [{ wordId: 'school', korean: '학교', mastery: 90, status: 'mastered', updatedAt: timestamp }, { wordId: 'student', korean: '학생', mastery: 45, status: 'review', updatedAt: timestamp }];
    const history = [{ id: 'practice-1', setId: 'practice-general', completedAt: timestamp, durationSeconds: 900, skill: 'listening', percentage: 42, skillBreakdown: { listening: 42, grammar: 54 } }];
    await evaluate(cdp, `(() => { const user=${JSON.stringify(user)}; localStorage.clear(); localStorage.setItem('klearn_users',JSON.stringify([user])); localStorage.setItem('klearn_session',JSON.stringify({userId:user.id,createdAt:${JSON.stringify(timestamp)}})); localStorage.setItem('klearn_progress',JSON.stringify({[user.id]:${JSON.stringify(progress)}})); localStorage.setItem('klearn_srs',JSON.stringify({[user.id]:${JSON.stringify(srs)}})); localStorage.setItem('klearn_practice_history',JSON.stringify({[user.id]:${JSON.stringify(history)}})); localStorage.setItem('klearn_settings',JSON.stringify({schemaVersion:13,users:{[user.id]:{theme:'dark',language:'vi'}}})); location.hash='learning-intelligence-memory'; location.reload(); })()`);
    assert.equal(await until(cdp, `Boolean(window.LongTermLearningMemoryService && document.querySelector('.p71-grid'))`), true, 'P71A route did not load');

    const flow = await evaluate(cdp, `(() => { window.ErrorNotebookService?.add?.({type:'grammar',question:'은/는 và 이/가',mistake:'이/가',correction:'은/는',count:5}); const diagnostic=window.FullLearningDiagnosticService.run({scores:{pronunciation:52}}); const prescription=window.PersonalLearningPrescriptionService.create(14); const goal=window.LearningGoalSimulatorService.simulate('topik',12,'TOPIK 4'); const context=window.KLEARN_APP.AITutorService.context('Tôi không hiểu câu này'); const before=window.LongTermLearningMemoryService.all().length; window.KLEARN_APP.state.currentUser={id:'p71a-other',studyMinutesPerDay:10,onboardingCompleted:true}; const isolated=window.LongTermLearningMemoryService.all().length===0; window.KLEARN_APP.state.currentUser=${JSON.stringify(user)}; return {skillCount:Object.keys(diagnostic.skills).length,weakest:diagnostic.weakest,coverage:diagnostic.coverage,days:prescription.days,lastDay:prescription.phases.at(-1).toDay,goalMonth:goal.timeline.at(-1).month,contextFields:['learningMemorySummary','diagnosticSummary','learningPrescription','goalSimulation','mistakePatterns'].every((key)=>Object.hasOwn(context,key)),privateLeak:/password|token|secret|credential/i.test(JSON.stringify(context)),isolated,before,restored:window.LongTermLearningMemoryService.all().length}; })()`);
    assert.equal(flow.skillCount, 7); assert.ok(flow.weakest, 'weakest skill missing'); assert.equal(flow.coverage, 100); assert.equal(flow.days, 14); assert.equal(flow.lastDay, 14); assert.equal(flow.goalMonth, 12); assert.equal(flow.contextFields, true); assert.equal(flow.privateLeak, false); assert.equal(flow.isolated, true); assert.equal(flow.restored, flow.before);

    const results = [];
    for (const width of [360, 768, 1024, 1440, 1920]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 1100, deviceScaleFactor: 1, mobile: false }); await evaluate(cdp, `window.KLEARN_APP.setView('learning-diagnostic')`); await wait(100);
      const metrics = await evaluate(cdp, `(() => { const rect=(node)=>{const value=node?.getBoundingClientRect();return value?{left:value.left,width:value.width}:null}; return {dark:document.documentElement.dataset.theme==='dark',htmlOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,bodyOverflow:document.body.scrollWidth>document.body.clientWidth,app:rect(document.getElementById('app')),nav:rect(document.getElementById('bottomNav')),card:rect(document.querySelector('.p71-card'))}; })()`);
      assert.equal(metrics.dark, true, `dark mode missing at ${width}px`); assert.equal(metrics.htmlOverflow, false, `html overflow at ${width}px`); assert.equal(metrics.bodyOverflow, false, `body overflow at ${width}px`); assert.ok(metrics.card?.width <= width, `diagnostic card exceeds ${width}px`);
      if (width >= 1024) { assert.ok(metrics.nav.width >= 240 && metrics.nav.width <= 280, `sidebar invalid at ${width}px`); assert.ok(metrics.app.left >= 240, `content overlaps sidebar at ${width}px`); } else assert.ok(metrics.app.left < 2, `compact offset at ${width}px`);
      results.push({ width, sidebar: Math.round(metrics.nav.width), overflow: metrics.htmlOverflow });
    }
    assert.equal(await evaluate(cdp, `localStorage.getItem('klearn_progress').includes('keep-me') && localStorage.getItem('klearn_srs').includes('school')`), true, 'existing learning data changed');
    await evaluate(cdp, `location.reload()`); assert.equal(await until(cdp, `Boolean(window.LongTermLearningMemoryService && window.LongTermLearningMemoryService.records('diagnostic').length)`), true, 'memory did not survive reload');
    console.log(JSON.stringify(results)); console.log('P71A browser: persistent memory, 7-skill diagnostic, prescription, goal timeline, private AI context, user isolation, dark mode and 360-1920 responsive passed'); cdp.close();
  } finally { browser.kill(); await wait(200); fs.rmSync(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 }); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
