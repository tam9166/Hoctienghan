/* Real-browser P78 QA: node tests/p78-mobile-native-responsive.browser.js [url] */
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const edge = [path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')].find((candidate) => candidate && fs.existsSync(candidate));
if (!edge) throw new Error('Microsoft Edge is required for P78 responsive QA.');
const baseUrl = process.argv[2] || 'http://127.0.0.1:4173/';
const port = 11300 + Math.floor(Math.random() * 80);
const profile = path.join(os.tmpdir(), `klearn-p78-browser-${process.pid}`);
const browser = childProcess.spawn(edge, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--disable-gpu', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore', windowsHide: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function json(url, options) { const response = await fetch(url, options); if (!response.ok) throw new Error(`${response.status} ${url}`); return response.json(); }
async function connect(url) { const socket = new WebSocket(url); let id = 0; const pending = new Map(); await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; }); socket.onmessage = (event) => { const message = JSON.parse(event.data); const request = pending.get(message.id); if (!request) return; pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); }; return { send(method, params = {}) { return new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })); }); }, close() { socket.close(); } }; }
async function evaluate(cdp, expression) { const output = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (output.exceptionDetails) throw new Error(output.exceptionDetails.exception?.description || output.exceptionDetails.text); return output.result.value; }
async function until(cdp, expression, attempts = 240) { for (let attempt = 0; attempt < attempts; attempt += 1) { if (await evaluate(cdp, expression)) return true; await wait(100); } return false; }

(async () => {
  let cdp;
  try {
    let version; for (let attempt = 0; attempt < 60 && !version; attempt += 1) { try { version = await json(`http://127.0.0.1:${port}/json/version`); } catch (_) { await wait(100); } }
    if (!version) throw new Error('Could not start Edge.');
    const target = await json(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(`${baseUrl}?p78=1`)}`, { method: 'PUT' });
    cdp = await connect(target.webSocketDebuggerUrl); await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    assert.equal(await until(cdp, `document.readyState === 'complete' && Boolean(window.KLEARN_APP)`), true, 'page did not load');
    const timestamp = new Date().toISOString();
    const user = { id: 'p78-mobile-user', fullName: 'Mobile P78', email: 'p78@local.test', level: 'TOPIK 1', learningTrack: 'topik', goals: ['topik'], studyMinutesPerDay: 15, currentTopikLevel: 1, onboardingCompleted: true, createdAt: timestamp };
    await evaluate(cdp, `(() => { const user=${JSON.stringify(user)}; localStorage.clear(); localStorage.setItem('klearn_users',JSON.stringify([user])); localStorage.setItem('klearn_session',JSON.stringify({userId:user.id,createdAt:${JSON.stringify(timestamp)}})); localStorage.setItem('klearn_progress',JSON.stringify({[user.id]:{p78Marker:'keep-progress',lessonProgress:{},stats:{streak:2},daily:{}}})); localStorage.setItem('klearn_srs',JSON.stringify({[user.id]:[{id:'p78-srs',wordId:'w1',state:'learning'}]})); localStorage.setItem('klearn_settings',JSON.stringify({schemaVersion:13,users:{[user.id]:{theme:'dark',language:'vi',privacy:{telemetry:false,cloudSync:true}}}})); location.hash='home'; location.reload(); })()`);
    assert.equal(await until(cdp, `Boolean(window.KLEARN_APP?.state?.currentUser && document.querySelector('#bottomNav:not(.hidden)'))`), true, 'authenticated mobile shell did not load');
    await evaluate(cdp, `KLEARN_APP.setView('profile')`);
    const p78Ready = await until(cdp, `Boolean(window.MobileNativePlatformService && document.querySelector('[data-p78-entry]'))`);
    if (!p78Ready) console.error(await evaluate(cdp, `JSON.stringify({route:KLEARN_APP.state.currentView,groups:KLEARN_ROUTE_LOADER.groupsFor('profile'),loaded:KLEARN_ROUTE_LOADER.loaded(),service:Boolean(window.MobileNativePlatformService),entry:Boolean(document.querySelector('[data-p78-entry]')),scripts:[...document.scripts].map(s=>s.src).filter(s=>s.includes('mobile-native')),styles:[...document.styleSheets].map(s=>s.href).filter(Boolean).filter(s=>s.includes('p78'))})`));
    assert.equal(p78Ready, true, 'P78 profile entry did not lazy load');
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

    const routes = ['home', 'lessons', 'review', 'speaking-hub', 'ai-coach', 'profile', 'mobile-native-p78'];
    const results = [];
    for (const width of [320, 360, 390, 430]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: true });
      for (const route of routes) {
        await evaluate(cdp, `KLEARN_APP.setView(${JSON.stringify(route)})`);
        assert.equal(await until(cdp, `KLEARN_APP.state.currentView===${JSON.stringify(route)} && document.getElementById('app').children.length>0`), true, `${route} did not render at ${width}px`);
        await wait(80);
        const layout = await evaluate(cdp, `(() => { const root=document.documentElement, app=document.getElementById('app'), bottom=document.getElementById('bottomNav'), nav=[...bottom.querySelectorAll('.nav-item')].filter((item)=>getComputedStyle(item).display!=='none'); return {route:KLEARN_APP.state.currentView,width:innerWidth,htmlOverflow:root.scrollWidth>root.clientWidth+1,bodyOverflow:document.body.scrollWidth>document.body.clientWidth+1,appRight:Math.round(app.getBoundingClientRect().right),navCount:nav.length,minNavTouch:Math.min(...nav.map((item)=>item.getBoundingClientRect().height)),navHeight:bottom.getBoundingClientRect().height,navDisplay:getComputedStyle(bottom).display,navClass:bottom.className,labels:nav.map((item)=>item.dataset.route)}; })()`);
        assert.equal(layout.htmlOverflow, false, `html overflow in ${route} at ${width}px`);
        assert.equal(layout.bodyOverflow, false, `body overflow in ${route} at ${width}px`);
        assert.ok(layout.appRight <= width + 1, `${route} exceeds ${width}px viewport`);
        assert.equal(layout.navCount, 5, `bottom navigation is not five items in ${route} at ${width}px`);
        assert.ok(layout.minNavTouch >= 48, `bottom navigation touch target ${layout.minNavTouch}px below 48px at ${width}px (${JSON.stringify(layout)})`);
        results.push({ width, route, nav: layout.navCount, overflow: false });
      }
    }

    await evaluate(cdp, `KLEARN_APP.setView('mobile-native-p78')`); await wait(100);
    const controls = await evaluate(cdp, `Math.min(...[...document.querySelectorAll('.p78-shell button,.p78-shell select,.p78-switch,.p78-checks label')].map((item)=>item.getBoundingClientRect().height).filter(Boolean))`);
    assert.ok(controls >= 48, `P78 touch target below 48px: ${controls}`);
    const fallback = await evaluate(cdp, `(async()=>{const original=window.VoiceCaptureService;window.VoiceCaptureService=null;const result=await MobileMicrophoneExperienceService.start();window.VoiceCaptureService=original;return result;})()`);
    assert.equal(fallback.status, 'text-fallback', 'microphone fallback failed');
    const deepLink = await evaluate(cdp, `NativeDeepLinkService.open('tamhoanq://lesson/topik1/unit5')`);
    assert.equal(deepLink.route, 'lesson-preview', 'lesson deep link failed');
    assert.equal(await evaluate(cdp, `KLEARN_APP.state.selectedLessonPreview`), 'unit5');
    assert.equal(await evaluate(cdp, `JSON.parse(localStorage.getItem('klearn_progress'))['p78-mobile-user'].p78Marker==='keep-progress' && JSON.parse(localStorage.getItem('klearn_srs'))['p78-mobile-user'][0].id==='p78-srs'`), true, 'progress or SRS was changed');
    await evaluate(cdp, `KLEARN_APP.setView('premium-benefits-p77')`);
    assert.equal(await until(cdp, `Boolean(window.P77SubscriptionService && P77SubscriptionService.current().effectivePlan==='free')`), true, 'P77 subscription regression');
    console.log(JSON.stringify({ status: 'passed', widths: [320,360,390,430], surfaces: routes, checks: results.length, navigationItems: 5, minimumTouchTarget: 48, microphoneFallback: true, deepLink: true, progressPreserved: true, srsPreserved: true, subscriptionPreserved: true }, null, 2));
  } finally {
    try { cdp?.close(); } catch (_) {}
    browser.kill(); await wait(300);
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 120 }); } catch (_) {}
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
