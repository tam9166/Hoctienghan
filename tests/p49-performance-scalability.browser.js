/* Real-browser P49 QA: node tests/p49-performance-scalability.browser.js [url] */
'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const edge = [path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')].find((candidate) => candidate && fs.existsSync(candidate));
if (!edge) throw new Error('Microsoft Edge is required for P49 browser QA.');
const baseUrl = process.argv[2] || 'http://127.0.0.1:4173/';
const port = 10720 + Math.floor(Math.random() * 80); const profile = path.join(os.tmpdir(), `klearn-p49-browser-${process.pid}-${Date.now()}`);
const browser = childProcess.spawn(edge, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--disable-gpu', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore', windowsHide: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function json(url, options) { const response = await fetch(url, options); if (!response.ok) throw new Error(`${response.status} ${url}`); return response.json(); }
async function connect(url) { const socket = new WebSocket(url); let id = 0; const pending = new Map(); await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; }); socket.onmessage = (event) => { const message = JSON.parse(event.data); const request = pending.get(message.id); if (!request) return; pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); }; return { send(method, params = {}) { return new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })); }); }, close() { socket.close(); } }; }
async function evaluate(cdp, expression) { const output = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (output.exceptionDetails) throw new Error(output.exceptionDetails.exception?.description || output.exceptionDetails.text); return output.result.value; }
async function until(cdp, expression, attempts = 150) { for (let attempt = 0; attempt < attempts; attempt += 1) { if (await evaluate(cdp, expression)) return true; await wait(100); } return false; }

(async () => {
  let cdp;
  try {
    let version; for (let attempt = 0; attempt < 70 && !version; attempt += 1) { try { version = await json(`http://127.0.0.1:${port}/json/version`); } catch (_) { await wait(100); } }
    if (!version) throw new Error('Could not start Edge.');
    const target = await json(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`, { method: 'PUT' }); cdp = await connect(target.webSocketDebuggerUrl);
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Network.enable'); await cdp.send('Performance.enable');
    assert.equal(await until(cdp, `Boolean(window.KLEARN_APP && window.KLEARN_ROUTE_LOADER && document.readyState === 'complete')`), true, 'app did not load');

    const cold = await evaluate(cdp, `(() => { const resources=performance.getEntriesByType('resource'); return {requests:resources.length+1,decoded:resources.reduce((sum,item)=>sum+(item.decodedBodySize||0),performance.getEntriesByType('navigation')[0]?.decodedBodySize||0),scripts:resources.filter((item)=>item.initiatorType==='script').length,styles:resources.filter((item)=>item.initiatorType==='link').length,advanced:Boolean(window.AdvancedContentService)}; })()`);
    assert.ok(cold.requests <= 45, `cold request budget exceeded: ${cold.requests}`);
    assert.ok(cold.decoded <= 1_200_000, `cold decoded budget exceeded: ${cold.decoded}`);
    assert.equal(cold.advanced, false, 'advanced content loaded before its route');

    await evaluate(cdp, `(async () => { const app=window.KLEARN_APP; localStorage.clear(); const user=await app.auth.register({fullName:'P49 Scale',email:'p49@local.test',password:'Safe-password-49'}); app.updateCurrentUser({onboardingCompleted:true,onboardingStep:'completed',learningTrack:'topik',currentTopikLevel:2}); app.setView('home'); return user.id; })()`);
    const responsive = [];
    for (const width of [360, 390, 430]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 780, deviceScaleFactor: 1, mobile: true }); await wait(80);
      responsive.push(await evaluate(cdp, `({width:${width},overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,navHidden:document.getElementById('bottomNav').classList.contains('hidden')})`));
    }
    assert.equal(responsive.some((item) => item.overflow || item.navHidden), false, JSON.stringify(responsive));
    await cdp.send('Emulation.clearDeviceMetricsOverride');

    const scale = await evaluate(cdp, `(() => {
      const app=window.KLEARN_APP; const userId=app.state.currentUser.id; const history=Array.from({length:10000},(_,index)=>({id:'attempt-'+index,setId:'set-'+(index%40),setTitle:'Scale attempt '+index,level:'TOPIK_2',completedAt:new Date(Date.now()-index*60000).toISOString(),durationSeconds:60,total:10,score:8,percentage:80,wrongQuestionIds:[]}));
      app.storage.set(app.STORAGE_KEYS.practiceHistory,{[userId]:history}); app.state.practiceHistoryPage=1; app.setView('practice-history');
      app.CloudSyncService.provider={getUserId:()=> 'cloud-p49',pull:async()=>null,push:async()=>true}; const snapshot=app.CloudSyncService.snapshot();
      const lessons=Array.from({length:500},(_,index)=>({id:'lesson-'+index,title:'Bài học '+index,topic:index===499?'mục tiêu đặc biệt':'chủ đề chung'})); const started=performance.now(); for(let i=0;i<100;i+=1) window.SearchIndexService.find('p49-lessons',lessons,(item)=>item.id+' '+item.title+' '+item.topic,'mục tiêu',20); const searchMs=performance.now()-started;
      return {localHistory:app.PracticeService.getHistory().length,rendered:document.querySelectorAll('.history-card').length,pages:document.querySelector('.pagination span')?.textContent,cloudHistory:snapshot.data[app.STORAGE_KEYS.practiceHistory].length,truncated:snapshot.syncPolicy.truncatedDomains[app.STORAGE_KEYS.practiceHistory],vocabulary:(window.KLEARN_DICTIONARY||[]).length,lessons:lessons.length,searchMs};
    })()`);
    assert.deepEqual({ localHistory: scale.localHistory, rendered: scale.rendered, pages: scale.pages, cloudHistory: scale.cloudHistory, truncated: scale.truncated, lessons: scale.lessons }, { localHistory: 10000, rendered: 30, pages: '1/334', cloudHistory: 1000, truncated: 9000, lessons: 500 });
    assert.ok(scale.vocabulary >= 1000, `vocabulary scale fixture too small: ${scale.vocabulary}`);
    assert.ok(scale.searchMs < 500, `indexed search too slow: ${scale.searchMs}ms`);

    await evaluate(cdp, `window.KLEARN_APP.setView('content-platform')`);
    assert.equal(await until(cdp, `Boolean(window.AdvancedContentService && document.querySelector('[data-route-asset="data/advanced-content-platform.js?v=1"]'))`), true, 'lazy route did not load');
    const lazy = await evaluate(cdp, `(() => { const before=document.querySelectorAll('[data-route-asset="data/advanced-content-platform.js?v=1"]').length; window.KLEARN_APP.setView('content-platform'); return {before,after:document.querySelectorAll('[data-route-asset="data/advanced-content-platform.js?v=1"]').length,loaded:window.KLEARN_ROUTE_LOADER.loaded().includes('content')}; })()`);
    assert.deepEqual(lazy, { before: 1, after: 1, loaded: true });
    assert.equal(await until(cdp, `Boolean(document.querySelector('.acp-hero'))`), true, 'advanced content did not finish loading');
    await cdp.send('HeapProfiler.enable'); await cdp.send('HeapProfiler.collectGarbage');
    const listenerMetric = async () => { const result = await cdp.send('Performance.getMetrics'); return Math.round(result.metrics.find((item) => item.name === 'JSEventListeners')?.value || 0); };
    const listenersBefore = await listenerMetric();
    await evaluate(cdp, `for(let i=0;i<30;i+=1) window.KLEARN_APP.setView('content-platform')`); await cdp.send('HeapProfiler.collectGarbage');
    const listenersAfter = await listenerMetric();
    assert.ok(listenersAfter - listenersBefore <= 10, `event listeners accumulated: ${listenersBefore} -> ${listenersAfter}`);

    await cdp.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    await evaluate(cdp, `(() => { window.__p49AppendChild=Node.prototype.appendChild; Node.prototype.appendChild=function(node){ if(String(node?.dataset?.routeAsset||'').includes('advanced-voice')){ setTimeout(()=>node.onerror?.(new Event('error')),0); return node; } return window.__p49AppendChild.call(this,node); }; Object.defineProperty(navigator,'onLine',{value:false,configurable:true}); window.dispatchEvent(new Event('offline')); window.KLEARN_APP.setView('advanced-voice'); })()`);
    const fallbackReady = await until(cdp, `Boolean(document.querySelector('.route-load-error'))`);
    const fallbackDebug = await evaluate(cdp, `({view:window.KLEARN_APP.state.currentView,html:document.getElementById('app').innerText.slice(0,240),voiceLoaded:window.KLEARN_ROUTE_LOADER.loaded().includes('voice'),assets:[...document.querySelectorAll('[data-route-asset]')].map((node)=>node.dataset.routeAsset)})`);
    assert.equal(fallbackReady, true, `offline lazy-route fallback missing: ${JSON.stringify(fallbackDebug)}`);
    const offline = await evaluate(cdp, `({banner:!document.getElementById('connectivityBanner').classList.contains('hidden'),text:document.getElementById('connectivityBanner').innerText})`);
    assert.equal(offline.banner, true); assert.match(offline.text, /ngoại tuyến/i);
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await evaluate(cdp, `(() => { if(window.__p49AppendChild) Node.prototype.appendChild=window.__p49AppendChild; Object.defineProperty(navigator,'onLine',{value:true,configurable:true}); window.dispatchEvent(new Event('online')); })()`);

    const metrics = await cdp.send('Performance.getMetrics'); const values = Object.fromEntries(metrics.metrics.map((item) => [item.name, item.value]));
    assert.ok(values.JSHeapUsedSize < 45 * 1024 * 1024, `heap budget exceeded: ${values.JSHeapUsedSize}`);
    console.log(JSON.stringify({ status: 'passed', cold, responsive, scale, lazy, listenerStability: { before: listenersBefore, after: listenersAfter }, offline: { banner: offline.banner }, heapUsedBytes: Math.round(values.JSHeapUsedSize), eventListeners: Math.round(values.JSEventListeners || 0) }, null, 2));
  } finally { cdp?.close(); browser.kill(); }
})().catch((error) => { console.error(error); browser.kill(); process.exitCode = 1; });
