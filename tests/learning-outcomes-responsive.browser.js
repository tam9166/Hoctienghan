/* Optional real-browser P52 QA: node tests/learning-outcomes-responsive.browser.js [url] */
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const edge = [path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')].find((candidate) => candidate && fs.existsSync(candidate));
if (!edge) throw new Error('Microsoft Edge is required for responsive browser QA.');
const baseUrl = process.argv[2] || 'http://127.0.0.1:4173/';
const port = 10500 + Math.floor(Math.random() * 80);
const profile = path.join(os.tmpdir(), `klearn-p52-browser-${process.pid}`);
const browser = childProcess.spawn(edge, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--disable-gpu', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore', windowsHide: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function json(url, options) { const response = await fetch(url, options); if (!response.ok) throw new Error(`${response.status} ${url}`); return response.json(); }
async function connect(url) { const socket = new WebSocket(url); let id = 0; const pending = new Map(); await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; }); socket.onmessage = (event) => { const message = JSON.parse(event.data); const request = pending.get(message.id); if (!request) return; pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); }; return { send(method, params = {}) { return new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })); }); }, close() { socket.close(); } }; }
async function evaluate(cdp, expression) { const output = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (output.exceptionDetails) throw new Error(output.exceptionDetails.exception?.description || output.exceptionDetails.text); return output.result.value; }
async function until(cdp, expression, attempts = 80) { for (let attempt = 0; attempt < attempts; attempt += 1) { if (await evaluate(cdp, expression)) return true; await wait(100); } return false; }

(async () => {
  try {
    let version;
    for (let attempt = 0; attempt < 50 && !version; attempt += 1) { try { version = await json(`http://127.0.0.1:${port}/json/version`); } catch (_) { await wait(100); } }
    if (!version) throw new Error('Could not start Edge.');
    const target = await json(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`, { method: 'PUT' });
    const cdp = await connect(target.webSocketDebuggerUrl); await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    assert.equal(await until(cdp, `document.readyState === 'complete'`), true, 'page did not load');
    const userId = 'p52-qa'; const timestamp = new Date().toISOString(); const daysAgo = (days) => new Date(Date.now() - days * 86400000).toISOString();
    const users = [{ id: userId, fullName: 'Outcome QA', email: 'outcome@local.test', currentTopikLevel: 1, targetTopikLevel: 2, onboardingCompleted: true, createdAt: timestamp }];
    const history = [30, 20, 10, 2].map((days, index) => ({ id: `attempt-${index}`, level: 'TOPIK_1', examMode: index > 1, setTitle: 'TOPIK 1', completedAt: daysAgo(days), percentage: [50, 58, 76, 84][index], skillBreakdown: { vocabulary: [48, 55, 78, 86][index], grammar: [50, 58, 72, 80][index], listening: [45, 52, 70, 78][index], speaking: [40, 48, 68, 76][index] } }));
    const srs = Array.from({ length: 12 }, (_, index) => ({ wordId: `word-${index}`, korean: `단어${index}`, createdAt: daysAgo(index < 6 ? 40 : 10), activatedAt: daysAgo(index < 6 ? 40 : 10), lastReviewed: daysAgo(1), reviewCount: 4, correctCount: 4, wrongCount: 0, mastery: 90, status: index < 6 ? 'mastered' : 'review' }));
    const session = { userId, createdAt: timestamp };
    const progress = { [userId]: { skills: {}, stats: { streak: 3 }, lessonProgress: { 'hangul-foundation': { completed: true, completedAt: daysAgo(15), score: 90 } }, daily: { date: timestamp.slice(0, 10), tasks: {} } } };
    const settings = { users: { [userId]: { theme: 'dark', language: 'vi' } } };
    await evaluate(cdp, `(() => { localStorage.setItem('klearn_users', ${JSON.stringify(JSON.stringify(users))}); localStorage.setItem('klearn_session', ${JSON.stringify(JSON.stringify(session))}); localStorage.setItem('klearn_progress', ${JSON.stringify(JSON.stringify(progress))}); localStorage.setItem('klearn_srs', ${JSON.stringify(JSON.stringify({ [userId]: srs }))}); localStorage.setItem('klearn_practice_history', ${JSON.stringify(JSON.stringify({ [userId]: history }))}); localStorage.setItem('klearn_settings', ${JSON.stringify(JSON.stringify(settings))}); location.hash='learning-outcomes'; location.reload(); })()`);
    assert.equal(await until(cdp, `Boolean(window.LearningOutcomeService && document.querySelector('.outcome-hero'))`), true, 'outcome dashboard did not render');
    const results = [];
    for (const width of [360, 768, 1024, 1440, 1920]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 1100, deviceScaleFactor: 1, mobile: false }); await wait(120);
      const metrics = await evaluate(cdp, `(() => { const app=document.getElementById('app'), nav=document.getElementById('bottomNav'), grid=document.querySelector('.outcome-skill-grid'); const rect=(node)=>{const value=node?.getBoundingClientRect();return value?{left:value.left,width:value.width,right:value.right}:null}; return { dark:document.documentElement.dataset.theme==='dark', htmlOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth, bodyOverflow:document.body.scrollWidth>document.body.clientWidth, app:rect(app), nav:rect(nav), columns:grid?getComputedStyle(grid).gridTemplateColumns.split(' ').length:0, cards:document.querySelectorAll('.outcome-skill-card').length }; })()`);
      assert.equal(metrics.dark, true, `dark mode missing at ${width}px`); assert.equal(metrics.htmlOverflow, false, `html overflow at ${width}px`); assert.equal(metrics.bodyOverflow, false, `body overflow at ${width}px`); assert.equal(metrics.cards, 4, `skill outcomes missing at ${width}px`); assert.equal(metrics.columns, width < 768 ? 1 : 2, `skill grid invalid at ${width}px`);
      if (width >= 1024) { assert.ok(metrics.nav.width >= 240 && metrics.nav.width <= 280, `sidebar invalid at ${width}px`); assert.ok(metrics.app.left >= 240, `content overlaps sidebar at ${width}px`); } else { assert.ok(metrics.app.left < 2, `compact content offset at ${width}px`); }
      results.push({ width, columns: metrics.columns, overflow: metrics.htmlOverflow, dark: metrics.dark });
    }
    await evaluate(cdp, `window.KLEARN_APP.setView('student-progress-report')`); assert.equal(await until(cdp, `Boolean(document.querySelector('.outcome-report-paper'))`), true, 'student report did not render');
    assert.equal(await evaluate(cdp, `document.body.textContent.includes('Before / After theo kỹ năng')`), true, 'before/after report section missing');
    console.log(JSON.stringify(results)); console.log('learning outcomes responsive: 360, 768, 1024, 1440, 1920, dark mode, no overflow and report passed'); cdp.close();
  } finally {
    browser.kill(); await wait(150); fs.rmSync(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
