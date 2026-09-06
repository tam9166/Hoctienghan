/* Real-browser P43 QA: node tests/ai-agent-architecture-responsive.browser.js [url] */
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const edge = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((candidate) => fs.existsSync(candidate)); if (!edge) throw new Error('Microsoft Edge is required for responsive browser QA.');
const baseUrl = process.argv[2] || 'http://127.0.0.1:4173/'; const port = 11000 + Math.floor(Math.random() * 80); const profile = path.join(os.tmpdir(), `klearn-p43-browser-${process.pid}`);
const browser = childProcess.spawn(edge, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--disable-gpu', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore', windowsHide: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)); async function json(url, options) { const response = await fetch(url, options); if (!response.ok) throw new Error(`${response.status} ${url}`); return response.json(); }
async function connect(url) { const socket = new WebSocket(url); let id = 0; const pending = new Map(); await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; }); socket.onmessage = (event) => { const message = JSON.parse(event.data); const request = pending.get(message.id); if (!request) return; pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); }; return { send(method, params = {}) { return new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })); }); }, close() { socket.close(); } }; }
async function evaluate(cdp, expression) { const output = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (output.exceptionDetails) throw new Error(output.exceptionDetails.exception?.description || output.exceptionDetails.text); return output.result.value; }
async function until(cdp, expression, attempts = 100) { for (let attempt = 0; attempt < attempts; attempt += 1) { if (await evaluate(cdp, expression)) return true; await wait(100); } return false; }

(async () => {
  try {
    let version; for (let attempt = 0; attempt < 50 && !version; attempt += 1) { try { version = await json(`http://127.0.0.1:${port}/json/version`); } catch (_) { await wait(100); } } if (!version) throw new Error('Could not start Edge.');
    const target = await json(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`, { method: 'PUT' }); const cdp = await connect(target.webSocketDebuggerUrl); await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); assert.equal(await until(cdp, `location.origin !== 'null' && document.readyState === 'complete'`), true, 'page did not load');
    const timestamp = new Date().toISOString(); const user = { id: 'p43-qa', fullName: 'P43 Learner', email: 'p43@local.test', level: 'TOPIK 1', studyMinutesPerDay: 20, onboardingCompleted: true, createdAt: timestamp };
    await evaluate(cdp, `(() => { localStorage.setItem('klearn_users', ${JSON.stringify(JSON.stringify([user]))}); localStorage.setItem('klearn_session', ${JSON.stringify(JSON.stringify({ userId: user.id, createdAt: timestamp }))}); localStorage.setItem('klearn_progress', ${JSON.stringify(JSON.stringify({ [user.id]: { skills: { listening: 45, vocabulary: 66, grammar: 58, writing: 52 }, stats: { streak: 3 }, lessonProgress: {}, daily: { date: timestamp.slice(0,10), tasks: {} } } }))}); localStorage.setItem('klearn_srs', ${JSON.stringify(JSON.stringify({ [user.id]: [] }))}); localStorage.setItem('klearn_settings', ${JSON.stringify(JSON.stringify({ theme: 'dark', language: 'vi', users: { [user.id]: { theme: 'dark', language: 'vi' } } }))}); location.hash='ai-coach'; location.reload(); })()`);
    assert.equal(await until(cdp, `Boolean(window.AIAgentLearningArchitecture && document.querySelector('[data-ai-agent-panel]'))`), true, 'P43 panel did not render');
    assert.equal(await evaluate(cdp, `document.querySelectorAll('.ai-agent-card').length`), 8, 'eight specialist cards required');
    assert.equal(await evaluate(cdp, `document.querySelector('[data-ai-agent-panel]').querySelectorAll('input,textarea,[contenteditable="true"]').length`), 0, 'P43 panel must not become a chatbot');
    assert.equal(await evaluate(cdp, `window.LearningAgentOrchestratorService.policy().maximumPrimaryAgents`), 1, 'orchestrator must run one primary agent');
    assert.equal(await evaluate(cdp, `window.LearningAgentOrchestratorService.policy().maximumRetries`), 0, 'agent loops are not allowed');
    const results = [];
    for (const width of [360, 768, 1024, 1440, 1920]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 1100, deviceScaleFactor: 1, mobile: false }); await wait(100);
      const metrics = await evaluate(cdp, `(() => { const app=document.getElementById('app'),nav=document.getElementById('bottomNav'),grid=document.querySelector('.ai-agent-grid'),panel=document.querySelector('[data-ai-agent-panel]');const rect=(node)=>{const r=node?.getBoundingClientRect();return r?{left:r.left,width:r.width,right:r.right}:null};return{dark:document.documentElement.dataset.theme==='dark',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,bodyOverflow:document.body.scrollWidth>document.body.clientWidth,app:rect(app),nav:rect(nav),panel:rect(panel),columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length,minTouch:Math.min(...[...document.querySelectorAll('.ai-agent-card')].map((node)=>node.getBoundingClientRect().height))};})()`);
      assert.equal(metrics.dark, true, `dark mode missing at ${width}px`); assert.equal(metrics.overflow, false, `html overflow at ${width}px`); assert.equal(metrics.bodyOverflow, false, `body overflow at ${width}px`); assert.ok(metrics.minTouch >= 44, `touch target too small at ${width}px`); assert.ok(metrics.panel.width <= metrics.app.width + 1, `panel exceeds app at ${width}px`);
      if (width >= 1024) { assert.ok(metrics.nav.width >= 240 && metrics.nav.width <= 280, `sidebar invalid at ${width}px`); assert.ok(metrics.app.left >= 240, `content overlaps sidebar at ${width}px`); } else assert.ok(metrics.app.left < 2, `compact content offset at ${width}px`);
      assert.equal(metrics.columns, width <= 560 ? 1 : width <= 1023 ? 2 : 4, `agent grid invalid at ${width}px`); results.push({ width, columns: metrics.columns, overflow: metrics.overflow });
    }
    const routed = await evaluate(cdp, `(async()=>{const r=await window.LearningAgentOrchestratorService.dispatch({intent:'today',payload:{enhance:false}});return{agentId:r.agentId,primary:r.primaryAgentsUsed,qc:r.qualityControllerRan,retries:r.retries};})()`);
    assert.equal(routed.agentId, 'planner'); assert.equal(routed.primary, 1); assert.equal(routed.qc, true); assert.equal(routed.retries, 0);
    assert.equal(await evaluate(cdp, `JSON.stringify(window.AIAgentAuditService.all()).includes('Ôn')`), false, 'audit leaked response content');
    console.log(JSON.stringify(results)); console.log('AI agent responsive: eight task cards, no chatbot input, dark mode, 360-1920 layout, bounded dispatch and metadata-only audit passed'); cdp.close();
  } finally { browser.kill(); await wait(200); if (path.resolve(profile).startsWith(path.resolve(os.tmpdir()))) fs.rmSync(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 }); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
