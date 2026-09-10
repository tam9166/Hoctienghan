/* Real-browser P60 QA: node tests/ai-language-operating-system-responsive.browser.js [url] */
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const edge = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((item) => fs.existsSync(item));
if (!edge) throw new Error('Microsoft Edge is required.');
const baseUrl = process.argv[2] || 'http://127.0.0.1:4173/';
const port = 11400 + Math.floor(Math.random() * 70);
const profile = path.join(os.tmpdir(), `klearn-p60-browser-${process.pid}`);
const browser = childProcess.spawn(edge, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--disable-gpu', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore', windowsHide: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function json(url, options) { const response = await fetch(url, options); if (!response.ok) throw new Error(`${response.status} ${url}`); return response.json(); }
async function connect(url) { const socket = new WebSocket(url); let id = 0; const pending = new Map(); await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; }); socket.onmessage = (event) => { const message = JSON.parse(event.data); const request = pending.get(message.id); if (!request) return; pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); }; return { send(method, params = {}) { return new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })); }); }, close() { socket.close(); } }; }
async function evaluate(cdp, expression) { const value = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (value.exceptionDetails) throw new Error(value.exceptionDetails.exception?.description || value.exceptionDetails.text); return value.result.value; }
async function until(cdp, expression, attempts = 120) { for (let index = 0; index < attempts; index += 1) { if (await evaluate(cdp, expression)) return true; await wait(100); } return false; }

(async () => {
  try {
    let version; for (let index = 0; index < 50 && !version; index += 1) { try { version = await json(`http://127.0.0.1:${port}/json/version`); } catch (_) { await wait(100); } }
    if (!version) throw new Error('Could not start Edge.');
    const target = await json(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`, { method: 'PUT' }); const cdp = await connect(target.webSocketDebuggerUrl); await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    assert.equal(await until(cdp, `location.origin !== 'null' && document.readyState === 'complete'`), true, 'page did not load');
    const timestamp = new Date().toISOString(); const user = { id: 'p60-qa', fullName: 'P60 Learner', email: 'p60@local.test', level: 'TOPIK 1', goalLabel: 'TOPIK 2', studyMinutesPerDay: 20, onboardingCompleted: true, createdAt: timestamp };
    const history = [1, 2, 3, 4].map((id) => ({ id: `attempt-${id}`, percentage: 70 + id, completedAt: new Date(Date.now() - id * 86400000).toISOString(), skillBreakdown: { listening: 52, grammar: 64, vocabulary: 76 } }));
    await evaluate(cdp, `(() => { localStorage.setItem('klearn_users', ${JSON.stringify(JSON.stringify([user]))}); localStorage.setItem('klearn_session', ${JSON.stringify(JSON.stringify({ userId: user.id, createdAt: timestamp }))}); localStorage.setItem('klearn_progress', ${JSON.stringify(JSON.stringify({ [user.id]: { skills: { listening: 52, grammar: 64, vocabulary: 76 }, stats: { streak: 4 }, lessonProgress: { 'legacy-korean': { masteryScore: 82 } }, daily: { tasks: {} } } }))}); localStorage.setItem('klearn_srs', ${JSON.stringify(JSON.stringify({ [user.id]: [{ id: '학교', wordId: '학교', korean: '학교', meaningVi: 'trường học', status: 'review', dueAt: '2026-09-01T00:00:00.000Z' }] }))}); localStorage.setItem('klearn_practice_history', ${JSON.stringify(JSON.stringify({ [user.id]: history }))}); localStorage.setItem('klearn_settings', ${JSON.stringify(JSON.stringify({ users: { [user.id]: { theme: 'dark', language: 'vi' } } }))}); location.hash='ai-language-os'; location.reload(); })()`);
    assert.equal(await until(cdp, `Boolean(window.AILanguageOperatingSystem?.version === 'p60-v1' && document.querySelector('.alos-hero') && document.querySelectorAll('.alos-language-grid article').length === 4)`), true, 'P60 dashboard did not render');
    assert.equal(await evaluate(cdp, `window.AILanguageOSContractService.get().capabilities.length`), 10);
    assert.equal(await evaluate(cdp, `document.querySelectorAll('.alos-card input,.alos-card textarea,[data-alos-entry] input,[data-alos-entry] textarea').length`), 0, 'P60 must not add a chatbot input');
    assert.equal(await evaluate(cdp, `window.PersonalLanguageMemoryService.update({goal:'TOPIK 3'}).status`), 'confirmation-required');
    assert.equal(await evaluate(cdp, `window.AIContentCuratorOSService.select(5).every(item => item.status === 'approved')`), true, 'curator exposed non-approved content');
    assert.equal(await evaluate(cdp, `window.AIProgressPredictionService.forecast().guaranteesOutcome`), false);
    assert.ok(await evaluate(cdp, `window.AIProgressPredictionService.forecast().probability`) <= 95);
    assert.equal(await evaluate(cdp, `window.AIMultiLanguageSupportService.matrix().filter(item => item.contentReady).length`), 1);
    assert.equal(await evaluate(cdp, `window.HumanAIHybridService.policy().aiReplacesTeacher`), false);

    const widths = [];
    for (const width of [360, 768, 1024, 1440, 1920]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 1200, deviceScaleFactor: 1, mobile: false }); await wait(100);
      const metrics = await evaluate(cdp, `(() => { const grid=document.querySelector('.alos-grid'),languages=document.querySelector('.alos-language-grid'),app=document.getElementById('app'),nav=document.getElementById('bottomNav'); const buttons=[...document.querySelectorAll('.alos-plan button,.alos-entry button')].filter(x=>x.offsetParent!==null); return { dark:document.documentElement.dataset.theme==='dark', overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth||document.body.scrollWidth>document.body.clientWidth, columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length, languageColumns:getComputedStyle(languages).gridTemplateColumns.split(' ').length, minTouch:buttons.length?Math.min(...buttons.map(x=>x.getBoundingClientRect().height)):44, appLeft:app.getBoundingClientRect().left, appWidth:app.getBoundingClientRect().width, heroWidth:document.querySelector('.alos-hero').getBoundingClientRect().width, navWidth:nav.getBoundingClientRect().width }; })()`);
      assert.equal(metrics.dark, true, `dark mode missing at ${width}px`); assert.equal(metrics.overflow, false, `overflow at ${width}px`); assert.ok(metrics.minTouch >= 44, `touch target at ${width}px`); assert.ok(metrics.heroWidth <= metrics.appWidth + 1, `hero exceeds app at ${width}px`);
      assert.equal(metrics.columns, width <= 620 ? 1 : 2, `main grid columns at ${width}px`);
      assert.equal(metrics.languageColumns, width <= 620 ? 1 : width <= 900 ? 2 : 4, `language columns at ${width}px`);
      if (width >= 1024) { assert.ok(metrics.navWidth >= 240 && metrics.navWidth <= 280, `sidebar width at ${width}px`); assert.ok(metrics.appLeft >= 240, `content overlaps sidebar at ${width}px`); } else assert.ok(metrics.appLeft < 2, `compact content offset at ${width}px`);
      widths.push({ width, columns: metrics.columns, languageColumns: metrics.languageColumns, overflow: metrics.overflow });
    }

    await evaluate(cdp, `window.KLEARN_APP.PrivacyPreferenceService.update({aiUsage:false})`);
    const disabled = await evaluate(cdp, `(async()=>{const result=await window.AIStudyPlannerOSService.explain();return{fallback:result.fallback,text:result.explanation};})()`);
    assert.equal(disabled.fallback, true); assert.match(disabled.text, /tắt AI/);
    assert.equal(await evaluate(cdp, `window.PersonalLanguageMemoryService.snapshot().containsRawConversation`), false);
    assert.equal(await evaluate(cdp, `JSON.stringify(window.ContinuousAIImprovementService.summary()).includes('raw')`), true);
    await evaluate(cdp, `location.reload()`); assert.equal(await until(cdp, `Boolean(window.AILanguageOperatingSystem)`), true); assert.equal(await evaluate(cdp, `(JSON.parse(localStorage.getItem('klearn_srs'))['p60-qa']||[]).some(item=>item.korean==='학교')`), true, 'legacy learning data was lost');
    console.log(JSON.stringify({ status: 'passed', widths, capabilities: 10, languages: 4, approvedCurationOnly: true, privacyFallback: true, teacherAuthorityPreserved: true, legacyDataPreserved: true })); cdp.close();
  } finally {
    browser.kill(); await wait(200); if (path.resolve(profile).startsWith(path.resolve(os.tmpdir()))) fs.rmSync(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
