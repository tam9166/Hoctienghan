/* Real-browser QA: node tests/dashboard-vocabulary-ux-responsive.browser.js */
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.join(__dirname, '..');
const edge = [path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')].find((candidate) => candidate && fs.existsSync(candidate));
if (!edge) throw new Error('Microsoft Edge is required for dashboard/vocabulary responsive QA.');
const webPort = 16940 + Math.floor(Math.random() * 100); const debugPort = 17060 + Math.floor(Math.random() * 100); const baseUrl = `http://127.0.0.1:${webPort}/`; const profile = path.join(os.tmpdir(), `klearn-vocab-ux-${process.pid}`);
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
    const target = await json(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(baseUrl)}`, { method: 'PUT' }); cdp = await connect(target.webSocketDebuggerUrl); await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    assert.equal(await until(cdp, `document.readyState==='complete'&&Boolean(window.KLEARN_APP)`), true, 'app did not load');
    await evaluate(cdp, `(async()=>{localStorage.clear();const app=KLEARN_APP;await app.auth.register({fullName:'Vocabulary UX',email:'vocab-ux-${Date.now()}@local.test',password:'Safe-password-2026',skipHydrate:true});app.updateCurrentUser({onboardingCompleted:true,learningTrack:'topik',level:'Beginner',currentTopikLevel:1,targetTopikLevel:2,studyMinutesPerDay:15,goals:['topik']});app.setView('home')})()`);
    assert.equal(await until(cdp, `Boolean(document.querySelector('.bla-function-directory')&&document.querySelector('.bla-adaptive-today'))`), true, 'compact home did not render');
    const widths = [];
    for (const width of [320, 360, 390, 430, 768, 1024, 1440, 1920]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 1200, deviceScaleFactor: 1, mobile: width <= 430 }); await evaluate(cdp, `KLEARN_APP.setView('home')`); await wait(60);
      const layout = await evaluate(cdp, `(()=>{const root=document.documentElement,v=Math.max(root.clientWidth,innerWidth),cta=document.querySelector('[data-bla-adaptive-start]'),directory=document.querySelector('.bla-function-directory');return{overflow:root.scrollWidth>v+1,bodyOverflow:document.body.scrollWidth>v+1,cta:cta?.getBoundingClientRect().height||0,directory:directory?.getBoundingClientRect().width||0}})()`);
      assert.equal(layout.overflow, false, `home html overflow at ${width}px`); assert.equal(layout.bodyOverflow, false, `home body overflow at ${width}px`); assert.ok(layout.cta >= 40); assert.ok(layout.directory > 0); widths.push(width);
    }
    await evaluate(cdp, `KLEARN_APP.setView('review')`); assert.equal(await until(cdp, `Boolean(window.VocabularyOnboardingService&&document.querySelector('[data-bla-vocab-quick]'))`), true, 'new vocabulary state did not render');
    const emptyState = await evaluate(cdp, `(()=>({title:document.querySelector('.page-heading h1')?.textContent,topics:document.querySelectorAll('[data-bla-topic-start]').length,quick:document.querySelector('[data-bla-vocab-quick]')?.getBoundingClientRect().height||0,orphan:/Không có từ phù hợp/.test(document.getElementById('app').innerText)}))()`);
    assert.equal(emptyState.title, 'Bắt đầu học từ vựng'); assert.ok(emptyState.topics >= 3); assert.ok(emptyState.quick >= 40); assert.equal(emptyState.orphan, false);
    await evaluate(cdp, `document.querySelector('[data-bla-topic-start="greetings"]').click()`); assert.equal(await until(cdp, `KLEARN_APP.state.currentView==='vocabulary-topic-p79'&&Boolean(document.querySelector('[data-p79-learn]'))`), true, 'topic did not open');
    await evaluate(cdp, `document.querySelector('[data-p79-learn]').click()`); assert.equal(await until(cdp, `KLEARN_APP.state.currentView==='vocabulary-learn-p79'&&Boolean(document.querySelector('.p79-listening-vocabulary'))`), true, 'Korean-first word did not open');
    const listening = await evaluate(cdp, `(()=>{window.__spoken=[];try{window.speechSynthesis.speak=(u)=>window.__spoken.push({text:u.text,rate:u.rate})}catch(_){};const block=document.querySelector('.p79-listening-vocabulary'),ko=block.querySelector('h1'),vi=block.querySelector('.p79-vietnamese-meaning'),buttons=block.querySelectorAll('[data-p79-audio]');buttons.forEach(b=>b.click());return{korean:ko?.textContent,order:Boolean(ko&&vi&&Boolean(ko.compareDocumentPosition(vi)&Node.DOCUMENT_POSITION_FOLLOWING)),audioButtons:buttons.length,slow:[...buttons].some(b=>b.dataset.rate==='0.7'),touch:[...buttons].every(b=>b.getBoundingClientRect().height>=40)}})()`);
    assert.ok(listening.korean); assert.equal(listening.order, true); assert.equal(listening.audioButtons, 2); assert.equal(listening.slow, true); assert.equal(listening.touch, true);
    await evaluate(cdp, `(()=>{const app=KLEARN_APP;app.saveUserSrs(Array.from({length:6},(_,i)=>({id:'ux-card-'+i,wordId:'ux-card-'+i,korean:'단어'+i,meaningVi:'từ '+i,topic:'greetings',topicLabel:'Chào hỏi',status:'review',reviewCount:2,wrongCount:i<2?2:0,mastery:i<2?30:60,nextReview:new Date(Date.now()-60000).toISOString(),activatedAt:new Date().toISOString()})));app.setView('review')})()`);
    assert.equal(await until(cdp, `Boolean(document.querySelector('.bla-review-summary')&&document.querySelector('[data-bla-review-mode]'))`), true, 'existing-user review did not render');
    const review = await evaluate(cdp, `({due:document.querySelector('.bla-review-summary strong')?.textContent,empty:Boolean(document.querySelector('[data-bla-vocab-quick]')),overflow:document.documentElement.scrollWidth>Math.max(document.documentElement.clientWidth,innerWidth)+1})`);
    assert.equal(review.due, '6'); assert.equal(review.empty, false); assert.equal(review.overflow, false);
    console.log(JSON.stringify({ status: 'passed', widths, compactDashboard: true, emptyVocabulary: true, existingVocabulary: true, koreanFirst: true, normalAndSlowAudio: true }, null, 2));
  } finally {
    try { cdp?.close(); } catch (_) {} browser.kill(); server.kill(); await wait(300); try { if (path.resolve(profile).startsWith(path.resolve(os.tmpdir()))) fs.rmSync(profile, { recursive: true, force: true, maxRetries: 6, retryDelay: 100 }); } catch (_) {}
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
