/* Real-browser P79 QA: node tests/p79-vocabulary-immersion-responsive.browser.js [url] */
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const edge = [path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')].find((candidate) => candidate && fs.existsSync(candidate));
if (!edge) throw new Error('Microsoft Edge is required for P79 responsive QA.');
const baseUrl = process.argv[2] || 'http://127.0.0.1:4173/';
const port = 11400 + Math.floor(Math.random() * 80);
const profile = path.join(os.tmpdir(), `klearn-p79-browser-${process.pid}`);
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
    const target = await json(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(`${baseUrl}?p79=1`)}`, { method: 'PUT' });
    cdp = await connect(target.webSocketDebuggerUrl); await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Network.enable');
    assert.equal(await until(cdp, `document.readyState === 'complete' && Boolean(window.KLEARN_APP)`), true, 'page did not load');
    const timestamp = new Date().toISOString();
    const user = { id: 'p79-vocabulary-user', fullName: 'Vocabulary P79', email: 'p79@local.test', level: 'TOPIK 1', learningTrack: 'topik', goals: ['topik'], studyMinutesPerDay: 15, currentTopikLevel: 1, onboardingCompleted: true, createdAt: timestamp };
    await evaluate(cdp, `(() => { const user=${JSON.stringify(user)}; localStorage.clear(); localStorage.setItem('klearn_users',JSON.stringify([user])); localStorage.setItem('klearn_session',JSON.stringify({userId:user.id,createdAt:${JSON.stringify(timestamp)}})); localStorage.setItem('klearn_progress',JSON.stringify({[user.id]:{p79Marker:'keep-progress',lessonProgress:{},skills:{vocabulary:12},stats:{streak:3},daily:{tasks:{}}}})); localStorage.setItem('klearn_srs',JSON.stringify({[user.id]:[{id:'p79-existing',wordId:'w1',korean:'사람',meaning:'người',status:'learning',mastery:20,reviewCount:1,activatedAt:${JSON.stringify(timestamp)},nextReview:${JSON.stringify(timestamp)}}]})); localStorage.setItem('klearn_settings',JSON.stringify({schemaVersion:13,users:{[user.id]:{theme:'dark',language:'vi'}}})); location.hash='lessons'; location.reload(); })()`);
    assert.equal(await until(cdp, `Boolean(window.KLEARN_APP?.state?.currentUser && window.P79VocabularyConfigService?.get?.() && document.querySelector('[data-p79-entry]'))`), true, 'P79 module/entry did not lazy load');
    assert.equal(await evaluate(cdp, `P79VocabularyConfigService.get().topics.length`), 17);
    assert.equal(await evaluate(cdp, `P79VocabularyConfigService.get().vocabulary.length >= 35`), true);

    await evaluate(cdp, `KLEARN_APP.setView('vocabulary-immersion-p79')`);
    assert.equal(await until(cdp, `document.querySelectorAll('.p79-topic-card').length===17`), true, 'topic library missing');
    const widths = []; const responsiveRoutes = ['vocabulary-immersion-p79','vocabulary-topic-p79','vocabulary-learn-p79']; const featureRoutes = ['vocabulary-practice-p79','personal-vocabulary-p79','vocabulary-offline-p79','vocabulary-analytics-p79'];
    await evaluate(cdp, `VocabularyTopicLibraryService.select('greetings'); window.KLEARN_APP.state.p79Vocabulary.wordId='p79-greetings-annyeong'; window.KLEARN_APP.state.p79Vocabulary.practiceMode='writing'`);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    for (const width of [320,360,390,430,768,1024,1440]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width <= 430 });
      for (const route of responsiveRoutes) {
        await evaluate(cdp, `KLEARN_APP.setView(${JSON.stringify(route)})`);
        assert.equal(await until(cdp, `KLEARN_APP.state.currentView===${JSON.stringify(route)} && Boolean(document.querySelector('.p79-shell'))`), true, `${route} did not render at ${width}px`);
        await wait(50);
        const layout = await evaluate(cdp, `(() => { const root=document.documentElement,app=document.getElementById('app'),controls=[...document.querySelectorAll('.p79-shell button:not([disabled]),.p79-shell input,.p79-shell select')].filter((node)=>getComputedStyle(node).display!=='none'&&node.getBoundingClientRect().width>0); return {htmlOverflow:root.scrollWidth>root.clientWidth+1,bodyOverflow:document.body.scrollWidth>document.body.clientWidth+1,appRight:Math.round(app.getBoundingClientRect().right),minTouch:controls.length?Math.min(...controls.map((node)=>node.getBoundingClientRect().height)):48,dark:root.dataset.theme==='dark'}; })()`);
        assert.equal(layout.htmlOverflow, false, `html overflow in ${route} at ${width}px`); assert.equal(layout.bodyOverflow, false, `body overflow in ${route} at ${width}px`); assert.ok(layout.appRight <= width + 1, `${route} exceeds ${width}px`); assert.ok(layout.minTouch >= 44, `touch target ${layout.minTouch}px in ${route} at ${width}px`); assert.equal(layout.dark, true, `dark theme missing at ${width}px`);
      }
      widths.push(width);
    }
    await cdp.send('Emulation.setDeviceMetricsOverride', { width:390, height:1000, deviceScaleFactor:1, mobile:true });
    for (const route of featureRoutes) { await evaluate(cdp, `KLEARN_APP.setView(${JSON.stringify(route)})`); assert.equal(await until(cdp, `KLEARN_APP.state.currentView===${JSON.stringify(route)} && Boolean(document.querySelector('.p79-shell'))`, 80), true, `${route} feature smoke failed`); }

    const mastery = await evaluate(cdp, `(() => { const id='p79-greetings-annyeong'; VocabularyMasteryBridgeService.activate(id); VocabularyPracticeService.grade(id,'reading','안녕하세요'); VocabularyPracticeService.grade(id,'listening','Xin chào'); VocabularyPracticeService.grade(id,'writing','안녕하세요'); VocabularyPracticeService.grade(id,'speaking','안녕하세요'); VocabularyPracticeService.grade(id,'context','안녕하세요'); const card=KLEARN_APP.getUserSrs().find((item)=>item.wordId===id); return {level:card.immersionLevel,status:card.status,mastery:card.mastery,evidence:Object.keys(card.immersionEvidence),sameSrs:Boolean(KLEARN_APP.state.srsData.find((item)=>item.wordId===id)),persisted:Boolean(JSON.parse(localStorage.getItem('klearn_srs'))['p79-vocabulary-user'].find((item)=>item.wordId===id))}; })()`);
    assert.equal(mastery.level, 5); assert.equal(mastery.status, 'mastered'); assert.equal(mastery.mastery, 100); assert.deepEqual(mastery.evidence.sort(), ['context','listening','reading','speaking','writing']); assert.equal(mastery.sameSrs, true); assert.equal(mastery.persisted, true);

    const personal = await evaluate(cdp, `(() => { const collection=PersonalVocabularyService.create('Từ trong phim'); const word=PersonalVocabularyService.add(collection.id,{korean:'대박',pronunciation:'dae-bak',meaning:'Tuyệt vời',wordType:'Cụm từ',example:'대박이에요!'}); return {collections:PersonalVocabularyService.all().length,wordId:word.id,inSrs:Boolean(KLEARN_APP.getUserSrs().find((item)=>item.wordId===word.id))}; })()`);
    assert.equal(personal.collections >= 1, true); assert.equal(personal.inSrs, true);
    const offline = await evaluate(cdp, `(async()=>await VocabularyOfflinePackService.download('p79-travel-vocabulary'))()`);
    assert.equal(offline.status, 'downloaded'); assert.equal(offline.learningDataPreserved, true);
    assert.equal(await evaluate(cdp, `JSON.parse(localStorage.getItem('klearn_progress'))['p79-vocabulary-user'].p79Marker==='keep-progress'`), true, 'existing progress marker changed');
    assert.equal(await evaluate(cdp, `KLEARN_APP.getUserSrs().some((item)=>item.id==='p79-existing')`), true, 'existing SRS card changed or removed');

    await cdp.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    await evaluate(cdp, `KLEARN_APP.setView('vocabulary-topic-p79')`); await wait(120);
    assert.equal(await evaluate(cdp, `Boolean(document.querySelector('.p79-word-list')) && VocabularyTopicLibraryService.words('greetings').length===2`), true, 'offline topic render failed');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    const analytics = await evaluate(cdp, `VocabularyAnalyticsService.summary()`); assert.ok(analytics.masteredWords >= 1); assert.ok(analytics.activeWords >= 2);
    console.log(JSON.stringify({ status:'passed', widths, responsiveRoutes, featureRoutes, checks:widths.length*responsiveRoutes.length+featureRoutes.length, topics:17, vocabulary:await evaluate(cdp, `P79VocabularyConfigService.get().vocabulary.length`), masteryLevel:mastery.level, sharedSrs:true, personalCollection:true, offlinePack:true, offlineTopicRender:true, progressPreserved:true }, null, 2));
  } finally {
    try { cdp?.close(); } catch (_) {}
    browser.kill(); await wait(300);
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 120 }); } catch (_) {}
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
