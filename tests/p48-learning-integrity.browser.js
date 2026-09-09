/* Real-browser P48 QA: node tests/p48-learning-integrity.browser.js [url] */
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const edge = [path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')].find((candidate) => candidate && fs.existsSync(candidate));
if (!edge) throw new Error('Microsoft Edge is required for P48 browser QA.');
const baseUrl = process.argv[2] || 'http://127.0.0.1:4173/';
const port = 10420 + Math.floor(Math.random() * 60); const profile = path.join(os.tmpdir(), `klearn-p48-browser-${process.pid}`);
const browser = childProcess.spawn(edge, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--disable-gpu', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore', windowsHide: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function json(url, options) { const response = await fetch(url, options); if (!response.ok) throw new Error(`${response.status} ${url}`); return response.json(); }
async function connect(url) { const socket = new WebSocket(url); let id = 0; const pending = new Map(); await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; }); socket.onmessage = (event) => { const message = JSON.parse(event.data); const request = pending.get(message.id); if (!request) return; pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); }; return { send(method, params = {}) { return new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })); }); }, close() { socket.close(); } }; }
async function evaluate(cdp, expression) { const output = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (output.exceptionDetails) throw new Error(output.exceptionDetails.exception?.description || output.exceptionDetails.text); return output.result.value; }
async function until(cdp, expression, attempts = 120) { for (let attempt = 0; attempt < attempts; attempt += 1) { if (await evaluate(cdp, expression)) return true; await wait(100); } return false; }

(async () => {
  let cdp;
  try {
    let version; for (let attempt = 0; attempt < 60 && !version; attempt += 1) { try { version = await json(`http://127.0.0.1:${port}/json/version`); } catch (_) { await wait(100); } }
    if (!version) throw new Error('Could not start Edge.');
    const target = await json(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`, { method: 'PUT' }); cdp = await connect(target.webSocketDebuggerUrl); await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    assert.equal(await until(cdp, `Boolean(window.KLEARN_APP?.SRSStateService && window.BackgroundSyncQueueService && document.readyState === 'complete')`), true, 'app did not load');

    const result = await evaluate(cdp, `(async () => {
      localStorage.clear(); location.hash='welcome'; const app=window.KLEARN_APP;
      const user=await app.auth.register({fullName:'P48 Learner',email:'p48@local.test',password:'Safe-password-48'});
      let cards=app.getUserSrs(); const fresh={total:cards.length,due:app.VocabularyService.dueCards().length,notStarted:cards.filter((card)=>card.status==='not_started'&&card.nextReview===null).length};
      const untouched={...cards[0],status:'new',nextReview:'2020-01-01T00:00:00.000Z',reviewCount:0,correctCount:0,wrongCount:0,mastery:0,lastReviewed:null,lastResult:null,activatedAt:null};
      const learned={...cards[1],status:'review',nextReview:'2020-01-01T00:00:00.000Z',reviewCount:7,correctCount:6,wrongCount:1,mastery:82,lastReviewed:'2026-01-01T00:00:00.000Z'};
      const all=JSON.parse(localStorage.getItem(app.STORAGE_KEYS.srs)); all[user.id]=[untouched,learned,...cards.slice(2)]; localStorage.setItem(app.STORAGE_KEYS.srs,JSON.stringify(all)); cards=app.getUserSrs(); app.state.srsData=cards;
      const migrated={untouched:cards[0],learned:cards[1],due:app.VocabularyService.dueCards().length};
      const mergeA={wordId:'merge-word',status:'review',mastery:90,reviewCount:8,correctCount:7,wrongCount:1,lastReviewed:'2026-08-01T00:00:00.000Z',nextReview:'2026-08-10T00:00:00.000Z',updatedAt:'2026-08-01T00:00:00.000Z'};
      const mergeB={wordId:'merge-word',status:'review',mastery:60,reviewCount:5,correctCount:4,wrongCount:1,lastReviewed:'2026-07-01T00:00:00.000Z',nextReview:'2099-01-01T00:00:00.000Z',updatedAt:'2026-07-01T00:00:00.000Z'};
      const merged=app.CloudSyncService.mergeSrs([mergeA],[mergeB])[0]; const deterministic=JSON.stringify(app.CloudSyncService.mergeSrs([mergeA],[mergeB]))===JSON.stringify(app.CloudSyncService.mergeSrs([mergeB],[mergeA]));
      const mastered=app.CloudSyncService.mergeSrs([{...mergeA,status:'mastered',nextReview:'2020-01-01T00:00:00.000Z'}],[])[0];
      app.updateCurrentUser({goals:['topik'],onboardingStep:'level'}); const resumed=app.auth.restoreSession();
      const cloudId='p48-cloud-'+Date.now(); app.auth.logout(); const cloud=(await app.CloudAccountService.attachCloudUser({id:cloudId,email:'cloud-p48@example.test',user_metadata:{full_name:'Cloud P48'}})).local;
      app.updateCurrentUser({onboardingCompleted:true,onboardingStep:'completed',learningTrack:'foundation',foundationEntry:'hangul-academy'}); await window.KLEARN_ROUTE_LOADER.load('home'); app.setView('home'); await new Promise((resolve)=>setTimeout(resolve,50)); const beginnerHome={view:app.state.currentView,text:document.getElementById('app').innerText};
      const lesson=(window.KLEARN_THEORY_LESSONS||[])[0]; app.state.selectedLessonPreview=lesson.id; app.state.sentenceCorrect=true; const beforeActive=app.state.srsData.filter((card)=>app.SRSStateService.isActive(card)).length; app.completeLesson(); const afterActive=app.state.srsData.filter((card)=>app.SRSStateService.isActive(card)).length;
      app.saveUserScoped(app.STORAGE_KEYS.backgroundSyncQueue,[],100); Object.defineProperty(navigator,'onLine',{value:false,configurable:true}); const mutation='p48-offline-fixed'; app.emitLearningMutation('completed_lesson','offline-lesson',{status:'completed'},mutation); app.emitLearningMutation('completed_lesson','offline-lesson',{status:'completed'},mutation); const queued=window.BackgroundSyncQueueService.all(); Object.defineProperty(navigator,'onLine',{value:true,configurable:true}); app.CloudSyncService.isConfigured=()=>true; app.CloudSyncService.flush=async()=>true; const flushed=await window.BackgroundSyncQueueService.flush();
      app.state.dictionarySelectedId=app.DictionaryService.all()[0].id; app.setView('dictionary'); const audioTransparent=document.body.innerText.includes('Giọng đọc thiết bị')&&document.body.innerText.includes('không phải bản thu người bản xứ');
      return {fresh,migrated:{untouchedStatus:migrated.untouched.status,untouchedDue:migrated.untouched.nextReview,reviewCount:migrated.learned.reviewCount,mastery:migrated.learned.mastery,due:migrated.due},merge:{mastery:merged.mastery,reviewCount:merged.reviewCount,nextReview:merged.nextReview,deterministic,masteredDue:app.SRSStateService.isDue(mastered)},resume:{step:resumed.onboardingStep,goals:resumed.goals},cloud:{completed:cloud.onboardingCompleted,step:cloud.onboardingStep},beginner:{foundation:beginnerHome.text.includes('Level 0')||beginnerHome.text.includes('Hangul'),advanced:beginnerHome.text.includes('Advanced Analytics')},lesson:{beforeActive,afterActive,completed:Boolean(app.getUserProgress().lessonProgress[lesson.id]?.completed),mastery:app.getUserProgress().lessonProgress[lesson.id]?.masteryStatus},offline:{queued:queued.length,mutationId:queued[0]?.mutationId,flushed},audioTransparent};
    })()`);
    assert.equal(result.fresh.total, 1000); assert.equal(result.fresh.due, 0); assert.equal(result.fresh.notStarted, 1000);
    assert.deepEqual(result.migrated, { untouchedStatus: 'not_started', untouchedDue: null, reviewCount: 7, mastery: 82, due: 1 });
    assert.deepEqual(result.merge, { mastery: 90, reviewCount: 8, nextReview: '2026-08-10T00:00:00.000Z', deterministic: true, masteredDue: false });
    assert.deepEqual(result.resume, { step: 'level', goals: ['topik'] }); assert.deepEqual(result.cloud, { completed: false, step: 'goals' });
    assert.deepEqual(result.beginner, { foundation: true, advanced: false }); assert.equal(result.lesson.completed, true); assert.notEqual(result.lesson.mastery, 'not_started'); assert.ok(result.lesson.afterActive > result.lesson.beforeActive);
    assert.equal(result.offline.queued, 1); assert.equal(result.offline.mutationId, 'p48-offline-fixed'); assert.deepEqual(result.offline.flushed, { flushed: 1, pending: 0, status: 'synced' }); assert.equal(result.audioTransparent, true);
    console.log('P48 browser: new/existing/cloud/beginner/lesson/offline/audio integrity passed');
  } finally { cdp?.close(); browser.kill(); }
})().catch((error) => { console.error(error); browser.kill(); process.exitCode = 1; });
