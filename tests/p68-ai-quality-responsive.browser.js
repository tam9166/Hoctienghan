/* Real-browser P68 QA: node tests/p68-ai-quality-responsive.browser.js [url] */
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const edge = [path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')].find((candidate) => candidate && fs.existsSync(candidate));
if (!edge) throw new Error('Microsoft Edge is required for responsive browser QA.');
const baseUrl = process.argv[2] || 'http://127.0.0.1:4173/';
const port = 10820 + Math.floor(Math.random() * 70);
const profile = path.join(os.tmpdir(), `klearn-p68-browser-${process.pid}`);
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
    const target = await json(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`, { method: 'PUT' });
    const cdp = await connect(target.webSocketDebuggerUrl); await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    assert.equal(await until(cdp, `location.origin !== 'null' && document.readyState === 'complete'`), true, 'page did not load');
    const timestamp = new Date().toISOString(); const user = { id: 'p68-qa', fullName: 'P68 QA', email: 'p68@local.test', level: 'TOPIK 1', currentTopikLevel: 1, onboardingCompleted: true, createdAt: timestamp };
    await evaluate(cdp, `(() => { const user=${JSON.stringify(user)}; localStorage.clear(); localStorage.setItem('klearn_users',JSON.stringify([user])); localStorage.setItem('klearn_session',JSON.stringify({userId:user.id,createdAt:${JSON.stringify(timestamp)}})); localStorage.setItem('klearn_progress',JSON.stringify({[user.id]:{p68RegressionMarker:'keep-me',skills:{grammar:35},stats:{streak:2},lessonProgress:{},daily:{date:${JSON.stringify(timestamp.slice(0,10))},tasks:{}}}})); localStorage.setItem('klearn_settings',JSON.stringify({schemaVersion:13,users:{[user.id]:{theme:'dark',language:'vi'}}})); location.hash='ai-coach'; location.reload(); })()`);
    assert.equal(await until(cdp, `Boolean(window.AIOrchestrationService?.__p68Enhanced && document.querySelector('[data-p68-quality-summary]'))`), true, 'P68 AI layer did not load');

    const results = [];
    for (const width of [360, 768, 1024, 1440, 1920]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 1100, deviceScaleFactor: 1, mobile: false }); await wait(100);
      const metrics = await evaluate(cdp, `(() => { const rect=(node)=>{const value=node?.getBoundingClientRect();return value?{left:value.left,width:value.width,right:value.right}:null}; return { width:innerWidth, dark:document.documentElement.dataset.theme==='dark', htmlOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth, bodyOverflow:document.body.scrollWidth>document.body.clientWidth, app:rect(document.getElementById('app')), nav:rect(document.getElementById('bottomNav')), summary:rect(document.querySelector('[data-p68-quality-summary]')) }; })()`);
      assert.equal(metrics.dark, true, `dark mode missing at ${width}px`);
      assert.equal(metrics.htmlOverflow, false, `html overflow at ${width}px`);
      assert.equal(metrics.bodyOverflow, false, `body overflow at ${width}px`);
      assert.ok(metrics.summary.width <= width, `AI quality summary exceeds ${width}px`);
      if (width >= 1024) { assert.ok(metrics.nav.width >= 240 && metrics.nav.width <= 280, `sidebar invalid at ${width}px`); assert.ok(metrics.app.left >= 240, `content overlaps sidebar at ${width}px`); }
      else assert.ok(metrics.app.left < 2, `compact content offset at ${width}px`);
      results.push({ width, sidebar: Math.round(metrics.nav.width), overflow: metrics.htmlOverflow });
    }

    const successful = await evaluate(cdp, `(async () => { const original=window.fetch; let calls=0, sent=null; window.fetch=async (_url,options)=>{ calls+=1; sent=JSON.parse(options.body); return {ok:true,json:async()=>({requestId:'browser-p68',reply:'Quy tắc: 은/는 đánh dấu chủ đề. Khi dùng: đặt sau danh từ. Ví dụ: 저는 학생이에요. Cảnh báo ngữ cảnh: 이/가 có thể phù hợp hơn.',quality:{status:'pass',displaySafe:true},usage:{inputTokens:10,outputTokens:20,totalTokens:30},modelRoute:'strong',promptVersion:'p68-grammar_support-v1',estimatedCostMicros:null,latencyMs:12})};}; const request={task:'grammar_support',input:'Giải thích 은/는',context:{currentTopikLevel:1,email:'private@example.com',password:'secret',fullDatabase:['no']},cachePolicy:'public'}; const first=await window.AIOrchestrationService.request(request); const second=await window.AIOrchestrationService.request(request); window.fetch=original; return {calls,firstFallback:first.fallback,secondCache:second.cacheStatus,context:sent.learnerContext,quality:first.quality}; })()`);
    assert.equal(successful.calls, 1);
    assert.equal(successful.firstFallback, false);
    assert.equal(successful.secondCache, 'hit');
    assert.equal('email' in successful.context, false);
    assert.equal('password' in successful.context, false);
    assert.equal('fullDatabase' in successful.context, false);
    assert.deepEqual(Object.keys(successful.quality.dimensions).sort(), ['accuracy','completeness','naturalness','usefulness']);

    const aiOff = await evaluate(cdp, `(async () => { let called=0; const original=window.fetch; window.fetch=async()=>{called+=1;throw new Error('must-not-call')}; window.KLEARN_APP.PrivacyPreferenceService.update({aiUsage:false}); const result=await window.AIOrchestrationService.request({task:'tutor',input:'Học gì?'}); window.KLEARN_APP.PrivacyPreferenceService.update({aiUsage:true}); window.fetch=original; return {called,fallback:result.fallback,core:result.learningCoreAvailable,reason:result.quality.reasons[0]}; })()`);
    assert.deepEqual(aiOff, { called: 0, fallback: true, core: true, reason: 'AI_DISABLED_BY_USER' });

    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    const offline = await evaluate(cdp, `(async () => { const result=await window.AIOrchestrationService.request({task:'sentence_correction',input:'저 학교 가요',context:{currentTopikLevel:1}}); return {fallback:result.fallback,core:result.learningCoreAvailable,text:result.reply}; })()`);
    assert.equal(offline.fallback, true);
    assert.equal(offline.core, true);
    assert.match(offline.text, /Không thể phân tích chính xác|tạm thời không khả dụng/);
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

    assert.equal(await evaluate(cdp, `localStorage.getItem('klearn_progress').includes('keep-me')`), true, 'learning progress changed during AI QA');
    assert.equal(await evaluate(cdp, `JSON.stringify(window.AIQualityAnalyticsService.logs()).includes('private@example.com') || JSON.stringify(window.AIQualityAnalyticsService.logs()).includes('Giải thích 은/는')`), false, 'raw prompt or private context entered analytics');
    console.log(JSON.stringify(results));
    console.log('P68 responsive: 360/768/1024/1440/1920, dark/no overflow, AI ON/OFF, context privacy, quality dimensions, public cache, offline fallback and progress isolation passed');
    cdp.close();
  } finally { browser.kill(); await wait(200); fs.rmSync(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 }); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
