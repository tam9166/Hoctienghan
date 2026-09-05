/* Optional real-browser QA: node tests/learning-analytics-responsive.browser.js [url] */
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const edge = [
  path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
].find((candidate) => candidate && fs.existsSync(candidate));
if (!edge) throw new Error('Microsoft Edge is required for optional responsive browser QA.');

const baseUrl = process.argv[2] || 'http://127.0.0.1:4173/';
const port = 9300 + Math.floor(Math.random() * 400);
const profile = path.join(os.tmpdir(), `klearn-p18-browser-${process.pid}`);
const browser = childProcess.spawn(edge, [`--headless=new`, `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--disable-gpu', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore', windowsHide: true });
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
async function json(url, options) { const response = await fetch(url, options); if (!response.ok) throw new Error(`${response.status} ${url}`); return response.json(); }
async function connect(wsUrl) {
  const socket = new WebSocket(wsUrl); let sequence = 0; const pending = new Map(); const events = new Map();
  socket.onmessage = (event) => { const message = JSON.parse(event.data); if (message.id && pending.has(message.id)) { const { resolve, reject } = pending.get(message.id); pending.delete(message.id); message.error ? reject(new Error(message.error.message)) : resolve(message.result); return; } const listeners = events.get(message.method) || []; listeners.splice(0).forEach((resolve) => resolve(message.params)); };
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  return {
    send(method, params = {}) { return new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); }); },
    once(method, timeout = 8000) { return new Promise((resolve, reject) => { const list = events.get(method) || []; const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${method}`)), timeout); list.push((value) => { clearTimeout(timer); resolve(value); }); events.set(method, list); }); },
    close() { socket.close(); }
  };
}
async function evaluate(cdp, expression) { const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(`${result.exceptionDetails.text}: ${result.exceptionDetails.exception?.description || ''}`); return result.result.value; }

(async () => {
  try {
    let version;
    for (let attempt = 0; attempt < 40 && !version; attempt += 1) { try { version = await json(`http://127.0.0.1:${port}/json/version`); } catch (_) { await wait(100); } }
    if (!version) throw new Error('Could not start Edge DevTools endpoint.');
    const target = await json(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`, { method: 'PUT' });
    const cdp = await connect(target.webSocketDebuggerUrl); await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await wait(500);
    const fixture = {
      users: [{ id: 'p18-qa', fullName: 'Responsive QA', email: 'qa@local.test', level: 'TOPIK 1', currentTopikLevel: 1, targetTopikLevel: 3, studyMinutesPerDay: 30, onboardingCompleted: true }],
      session: { userId: 'p18-qa', createdAt: new Date().toISOString() },
      progress: { 'p18-qa': { skills: { vocabulary: 78, grammar: 62, listening: 44, speaking: 55, reading: 70, writing: 58 }, stats: { streak: 4 }, lessonProgress: {}, daily: { date: new Date().toISOString().slice(0, 10), tasks: {} } } },
      srs: { 'p18-qa': [{ wordId: 'school', korean: '학교', mastery: 85, correctCount: 8, wrongCount: 1, reviewCount: 9, intervalDays: 4, lastReviewed: new Date(Date.now() - 45 * 86400000).toISOString(), nextReview: new Date(Date.now() - 30 * 86400000).toISOString() }] },
      history: { 'p18-qa': [{ id: 'qa-1', setId: 'qa', setTitle: 'QA', percentage: 78, durationSeconds: 900, completedAt: new Date().toISOString(), skillBreakdown: { listening: 78 } }] },
      settings: { users: { 'p18-qa': { theme: 'dark', language: 'vi' } } }
    };
    await evaluate(cdp, `(() => { localStorage.setItem('klearn_users', ${JSON.stringify(JSON.stringify(fixture.users))}); localStorage.setItem('klearn_session', ${JSON.stringify(JSON.stringify(fixture.session))}); localStorage.setItem('klearn_progress', ${JSON.stringify(JSON.stringify(fixture.progress))}); localStorage.setItem('klearn_srs', ${JSON.stringify(JSON.stringify(fixture.srs))}); localStorage.setItem('klearn_practice_history', ${JSON.stringify(JSON.stringify(fixture.history))}); localStorage.setItem('klearn_settings', ${JSON.stringify(JSON.stringify(fixture.settings))}); location.hash='analytics'; location.reload(); })()`);
    for (let attempt = 0; attempt < 40; attempt += 1) { if (await evaluate(cdp, `Boolean(document.querySelector('.learning-intelligence'))`)) break; await wait(100); }
    const results = [];
    for (const width of [360, 768, 1024, 1440, 1920]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false }); await wait(120);
      const metrics = await evaluate(cdp, `(() => { const app=document.getElementById('app'), nav=document.getElementById('bottomNav'), panel=document.querySelector('.learning-intelligence'), cards=document.querySelector('.li-metrics'); const rect=(node)=>{const value=node?.getBoundingClientRect();return value?{left:value.left,width:value.width,right:value.right}:null}; return { width:innerWidth, panel:Boolean(panel), dark:document.documentElement.dataset.theme==='dark', overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth, bodyOverflow:document.body.scrollWidth>document.body.clientWidth, app:rect(app), nav:rect(nav), navPosition:nav?getComputedStyle(nav).position:'missing', columns:cards?getComputedStyle(cards).gridTemplateColumns.split(' ').length:0 }; })()`);
      if (process.env.KLEARN_QA_DEBUG) console.log(metrics);
      assert.equal(metrics.panel, true, `analytics panel missing at ${width}px`); assert.equal(metrics.dark, true, `dark theme missing at ${width}px`); assert.equal(metrics.overflow, false, `html overflow at ${width}px`); assert.equal(metrics.bodyOverflow, false, `body overflow at ${width}px`);
      if (width >= 1024) { assert.ok(metrics.nav.width >= 240 && metrics.nav.width <= 280, `desktop sidebar width invalid at ${width}px`); assert.ok(metrics.app.left >= 240, `desktop content does not clear sidebar at ${width}px`); assert.ok(metrics.app.width >= width - 300, `desktop content does not use remaining width at ${width}px`); assert.equal(metrics.columns, 4, `desktop metrics grid should have four columns at ${width}px`); }
      else { assert.ok(metrics.nav.width <= width, `bottom navigation exceeds viewport at ${width}px`); assert.ok(metrics.app.left < 2, `mobile/tablet content unexpectedly offset at ${width}px`); assert.equal(metrics.columns, width <= 520 ? 2 : 2, `compact metrics grid invalid at ${width}px`); }
      results.push({ width, sidebar: Math.round(metrics.nav.width), app: Math.round(metrics.app.width), columns: metrics.columns, overflow: metrics.overflow, dark: metrics.dark });
    }
    console.log(JSON.stringify(results)); console.log('learning analytics responsive: 360, 768, 1024, 1440 and 1920 dark-mode layouts passed'); cdp.close();
  } finally {
    browser.kill();
    await wait(150);
    fs.rmSync(profile, { recursive: true, force: true });
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
