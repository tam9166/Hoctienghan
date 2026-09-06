/* Real-browser P35 QA: node tests/mobile-experience-responsive.browser.js [url] */
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const edge = [path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')].find((candidate) => candidate && fs.existsSync(candidate));
if (!edge) throw new Error('Microsoft Edge is required for responsive browser QA.');
const baseUrl = process.argv[2] || 'http://127.0.0.1:4173/';
const port = 10400 + Math.floor(Math.random() * 70);
const profile = path.join(os.tmpdir(), `klearn-p35-browser-${process.pid}`);
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
    assert.equal(await until(cdp, `document.readyState === 'complete' && Boolean(window.MobileExperienceService)`), true, 'mobile service did not load');
    const timestamp = new Date().toISOString();
    const user = { id: 'p35-qa', fullName: 'Mobile QA', email: 'p35@local.test', level: 'Beginner', goals: ['hobby'], currentTopikLevel: 1, targetTopikLevel: 1, onboardingCompleted: true, createdAt: timestamp };
    await evaluate(cdp, `(() => { localStorage.setItem('klearn_users', ${JSON.stringify(JSON.stringify([user]))}); localStorage.setItem('klearn_session', ${JSON.stringify(JSON.stringify({ userId: user.id, createdAt: timestamp }))}); localStorage.setItem('klearn_progress', ${JSON.stringify(JSON.stringify({ [user.id]: { skills: {}, stats: { streak: 1, lessonsCompleted: 0, learningDays: 1, wordsLearned: 0 }, lessonProgress: {}, daily: { date: timestamp.slice(0,10), tasks: {} }, pronunciationAttempts: [], writingSubmissions: [], mockTests: [] } }))}); location.hash='profile'; location.reload(); })()`);
    assert.equal(await until(cdp, `Boolean(document.querySelector('[data-mobile-experience]'))`), true, 'mobile profile panel did not render');

    for (const width of [360, 768, 1024, 1440, 1920]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 1050, deviceScaleFactor: 1, mobile: width < 768 }); await wait(100);
      const metrics = await evaluate(cdp, `(() => { const buttons=[...document.querySelectorAll('[data-mobile-experience] button')]; return { htmlOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth, bodyOverflow:document.body.scrollWidth>document.body.clientWidth, minTouch:Math.min(...buttons.map((node)=>node.getBoundingClientRect().height)), columns:getComputedStyle(document.querySelector('.mobile-capability-grid')).gridTemplateColumns.split(' ').length, darkReadable:getComputedStyle(document.querySelector('.mobile-experience-panel')).color !== 'rgba(0, 0, 0, 0)' }; })()`);
      assert.equal(metrics.htmlOverflow, false, `html overflow at ${width}px`); assert.equal(metrics.bodyOverflow, false, `body overflow at ${width}px`);
      assert.ok(metrics.minTouch >= (width < 768 ? 48 : 44), `mobile touch target too small at ${width}px`);
      assert.equal(metrics.columns, width < 768 ? 2 : 4, `mobile capability columns invalid at ${width}px`);
      assert.equal(metrics.darkReadable, true, `mobile panel unreadable at ${width}px`);
    }

    const summary = await evaluate(cdp, `(() => { const value=MobileExperienceService.summary(); return { max:value.notifications.policy.maximumPerDay, interval:value.notifications.policy.minimumIntervalHours, cameraUploads:value.camera.uploads, audioAsset:value.audio.requiresAudioAsset, shortcutRoutes:value.shortcuts.map((item)=>item.route), widgetPrivate:value.widget.containsPrivateContent }; })()`);
    assert.equal(summary.max, 2); assert.equal(summary.interval, 6); assert.equal(summary.cameraUploads, false); assert.equal(summary.audioAsset, true); assert.equal(summary.widgetPrivate, false);
    assert.deepEqual(summary.shortcutRoutes, ['speaking-hub', 'review', 'topik']);
    await evaluate(cdp, `document.querySelector('[data-mobile-performance]').value='on'; document.querySelector('[data-mobile-performance]').dispatchEvent(new Event('change',{bubbles:true}))`); await wait(50);
    assert.equal(await evaluate(cdp, `document.documentElement.classList.contains('low-performance')`), true, 'low performance mode did not apply');
    await evaluate(cdp, `document.querySelector('[data-mobile-shortcut="review"]').click()`); await wait(70);
    assert.equal(await evaluate(cdp, `window.KLEARN_APP.state.currentView`), 'review', 'mobile shortcut did not navigate');

    console.log('mobile responsive: 360, 768, 1024, 1440, 1920, no overflow, 48px touch, mobile services and low-performance mode passed');
    cdp.close();
  } finally {
    browser.kill(); await wait(200); fs.rmSync(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
