/* Real-browser P23 QA: node tests/product-ux-responsive.browser.js [url] */
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const edge = [path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')].find((candidate) => candidate && fs.existsSync(candidate));
if (!edge) throw new Error('Microsoft Edge is required for responsive browser QA.');
const baseUrl = process.argv[2] || 'http://127.0.0.1:4173/';
const port = 10220 + Math.floor(Math.random() * 70);
const profile = path.join(os.tmpdir(), `klearn-p23-browser-${process.pid}`);
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
    const cdp = await connect(target.webSocketDebuggerUrl);
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    assert.equal(await until(cdp, `location.origin !== 'null' && document.readyState === 'complete'`), true, 'page did not load');

    const timestamp = new Date().toISOString();
    const user = { id: 'p23-qa', fullName: 'P23 QA', email: 'p23@local.test', level: 'Level 0', learningTrack: 'foundation', foundationEntry: 'hangul-academy', goals: ['hobby'], studyMinutesPerDay: 15, onboardingCompleted: true, createdAt: timestamp };
    await evaluate(cdp, `(() => { localStorage.setItem('klearn_users', ${JSON.stringify(JSON.stringify([user]))}); localStorage.setItem('klearn_session', ${JSON.stringify(JSON.stringify({ userId: user.id, createdAt: timestamp }))}); localStorage.setItem('klearn_progress', ${JSON.stringify(JSON.stringify({ [user.id]: { skills: {}, stats: { streak: 2, lessonsCompleted: 0 }, lessonProgress: {}, daily: { date: timestamp.slice(0,10), tasks: {} } } }))}); localStorage.setItem('klearn_settings', ${JSON.stringify(JSON.stringify({ users: { [user.id]: { theme: 'dark', language: 'vi' } } }))}); localStorage.setItem('klearn_errors', ${JSON.stringify(JSON.stringify({ [user.id]: [{ id: 'ux-error', mistake: '은/는', correction: '이/가', explanation: 'Nhầm trợ từ', resolved: false }] }))}); localStorage.setItem('klearn_saved_sentences', ${JSON.stringify(JSON.stringify({ [user.id]: [{ id: 'ux-sentence', korean: '저는 학생이에요.', translation: 'Tôi là học sinh.' }] }))}); location.hash='home'; location.reload(); })()`);
    assert.equal(await until(cdp, `Boolean(window.ProductUxContentService && document.querySelector('.ux-home'))`), true, 'personalized Home did not render');
    assert.equal(await evaluate(cdp, `document.documentElement.dataset.theme === 'dark'`), true, 'dark mode was not preserved');
    assert.equal(await evaluate(cdp, `document.body.textContent.includes('Tiếp tục Hangul')`), true, 'beginner recommendation is missing');
    assert.equal(await evaluate(cdp, `document.body.textContent.includes('TOPIK Analytics')`), false, 'advanced analytics leaked into beginner Home');

    const results = [];
    for (const width of [360, 768, 1024, 1440, 1920]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 1050, deviceScaleFactor: 1, mobile: false }); await wait(120);
      const metrics = await evaluate(cdp, `(() => { const rect=(node)=>{const value=node?.getBoundingClientRect();return value?{left:value.left,width:value.width,right:value.right,bottom:value.bottom}:null}; const app=document.getElementById('app'), nav=document.getElementById('bottomNav'), recommended=document.querySelector('.ux-recommended>div'); return { width:innerWidth, dark:document.documentElement.dataset.theme==='dark', htmlOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth, bodyOverflow:document.body.scrollWidth>document.body.clientWidth, app:rect(app), nav:rect(nav), navPosition:getComputedStyle(nav).position, recommendationColumns:recommended?getComputedStyle(recommended).gridTemplateColumns.split(' ').length:0, minTouch:Math.min(...[...document.querySelectorAll('.ux-home button')].map((node)=>node.getBoundingClientRect().height)) }; })()`);
      assert.equal(metrics.dark, true, `dark mode missing at ${width}px`);
      assert.equal(metrics.htmlOverflow, false, `html overflow at ${width}px`);
      assert.equal(metrics.bodyOverflow, false, `body overflow at ${width}px`);
      assert.ok(metrics.minTouch >= 44, `touch target below 44px at ${width}px`);
      if (width >= 1024) { assert.ok(metrics.nav.width >= 240 && metrics.nav.width <= 280, `sidebar invalid at ${width}px`); assert.ok(metrics.app.left >= 240, `content overlaps desktop sidebar at ${width}px`); }
      else { assert.ok(metrics.app.left < 2, `mobile/tablet content offset at ${width}px`); assert.ok(metrics.nav.width <= width, `bottom navigation overflows at ${width}px`); }
      assert.equal(metrics.recommendationColumns, width >= 600 ? 2 : 1, `recommendation layout invalid at ${width}px`);
      results.push({ width, sidebar: Math.round(metrics.nav.width), columns: metrics.recommendationColumns, overflow: metrics.htmlOverflow, dark: metrics.dark });
    }

    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 1100, deviceScaleFactor: 1, mobile: false });
    await evaluate(cdp, `window.KLEARN_APP.setView('command-center')`); await wait(100);
    assert.equal(await evaluate(cdp, `document.querySelectorAll('.ux-command-grid>button').length`), 2, 'beginner Command Center must disclose only core commands');
    assert.equal(await evaluate(cdp, `document.body.textContent.includes('công cụ nâng cao đang được ẩn')`), true, 'progressive disclosure explanation is missing');

    await evaluate(cdp, `window.KLEARN_APP.setView('search')`); await wait(100);
    await evaluate(cdp, `(() => { const input=document.getElementById('uxSearchInput'); input.value='학교'; input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true})); })()`);
    assert.ok(await evaluate(cdp, `document.querySelectorAll('#uxAutocomplete [role="option"]').length`), 'autocomplete has no options');
    assert.match(await evaluate(cdp, `document.getElementById('uxSearchInput').getAttribute('aria-activedescendant') || ''`), /^ux-option-/);
    await evaluate(cdp, `document.getElementById('uxSearchInput').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
    assert.equal(await evaluate(cdp, `document.getElementById('uxSearchInput').getAttribute('aria-expanded')`), 'false');
    await evaluate(cdp, `(() => { const input=document.getElementById('uxSearchInput'); input.value='는'; document.getElementById('uxSearchForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})); })()`); await wait(100);
    assert.equal(await evaluate(cdp, `document.body.textContent.includes('Lỗi của tôi') && document.body.textContent.includes('Câu')`), true, 'search did not expose mistake and sentence categories');

    await evaluate(cdp, `window.KLEARN_APP.setView('ux-settings')`); await wait(80);
    await evaluate(cdp, `(() => { document.querySelector('input[name="fontScale"][value="large"]').checked=true; document.querySelector('input[name="contrast"][value="high"]').checked=true; document.querySelector('input[name="reduceMotion"]').checked=true; document.getElementById('uxAccessibilityForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})); })()`); await wait(100);
    const a11y = await evaluate(cdp, `({ fontScale:document.documentElement.dataset.fontScale, contrast:document.documentElement.dataset.contrast, reduceMotion:document.documentElement.dataset.reduceMotion, rootFont:getComputedStyle(document.documentElement).fontSize, skip:Boolean(document.querySelector('.skip-link[href="#app"]')) })`);
    assert.equal(a11y.fontScale, 'large'); assert.equal(a11y.contrast, 'high'); assert.equal(a11y.reduceMotion, 'true'); assert.equal(a11y.rootFont, '18px'); assert.equal(a11y.skip, true);

    await evaluate(cdp, `window.KLEARN_APP.setView('notes')`); await wait(80);
    assert.equal(await evaluate(cdp, `Boolean(document.querySelector('.empty-state [data-ux-empty-action]'))`), true, 'empty state lacks a next action');

    await evaluate(cdp, `(() => { const users=JSON.parse(localStorage.getItem('klearn_users')); users[0].onboardingCompleted=false; users[0].onboardingStep='goals'; localStorage.setItem('klearn_users',JSON.stringify(users)); location.hash='onboarding-goals'; location.reload(); })()`);
    assert.equal(await until(cdp, `Boolean(document.querySelector('[data-ux-goal]'))`), true, 'short onboarding did not load');
    await evaluate(cdp, `document.querySelector('[data-ux-goal="hobby"]').click(); document.getElementById('uxOnboardingGoalsNext').click()`); await wait(100);
    assert.equal(await evaluate(cdp, `Boolean(document.querySelector('[data-ux-level]'))`), true, 'onboarding level screen did not render');
    await evaluate(cdp, `document.querySelector('[data-ux-level="foundation-unknown"]').click()`); await wait(60);
    await evaluate(cdp, `document.querySelector('[data-ux-minutes="15"]').click()`); await wait(60);
    await evaluate(cdp, `document.getElementById('uxOnboardingFinish').click()`); await wait(120);
    const onboarding = await evaluate(cdp, `({ view:window.KLEARN_APP.state.currentView, completed:window.KLEARN_APP.state.currentUser.onboardingCompleted, track:window.KLEARN_APP.state.currentUser.learningTrack, minutes:window.KLEARN_APP.state.currentUser.studyMinutesPerDay })`);
    assert.deepEqual(onboarding, { view: 'home', completed: true, track: 'foundation', minutes: 15 });

    console.log(JSON.stringify(results));
    console.log('product UX responsive: 360, 768, 1024, 1440, 1920, dark mode, progressive disclosure, autocomplete keyboard, empty/error UX, accessibility and two-step onboarding passed');
    cdp.close();
  } finally {
    browser.kill(); await wait(200); fs.rmSync(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
