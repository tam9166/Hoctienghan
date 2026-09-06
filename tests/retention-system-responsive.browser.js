/* Real-browser P24 QA: node tests/retention-system-responsive.browser.js [url] */
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const edge = [path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')].find((candidate) => candidate && fs.existsSync(candidate));
if (!edge) throw new Error('Microsoft Edge is required for responsive browser QA.');
const baseUrl = process.argv[2] || 'http://127.0.0.1:4173/';
const port = 10340 + Math.floor(Math.random() * 70);
const profile = path.join(os.tmpdir(), `klearn-p24-browser-${process.pid}`);
const browser = childProcess.spawn(edge, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--disable-gpu', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore', windowsHide: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function json(url, options) { const response = await fetch(url, options); if (!response.ok) throw new Error(`${response.status} ${url}`); return response.json(); }
async function connect(url) { const socket = new WebSocket(url); let id = 0; const pending = new Map(); await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; }); socket.onmessage = (event) => { const message = JSON.parse(event.data); const request = pending.get(message.id); if (!request) return; pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); }; return { send(method, params = {}) { return new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })); }); }, close() { socket.close(); } }; }
async function evaluate(cdp, expression) { const output = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (output.exceptionDetails) throw new Error(output.exceptionDetails.exception?.description || output.exceptionDetails.text); return output.result.value; }
async function until(cdp, expression, attempts = 80) { for (let attempt = 0; attempt < attempts; attempt += 1) { if (await evaluate(cdp, expression)) return true; await wait(100); } return false; }

(async () => {
  try {
    let version; for (let attempt = 0; attempt < 50 && !version; attempt += 1) { try { version = await json(`http://127.0.0.1:${port}/json/version`); } catch (_) { await wait(100); } }
    if (!version) throw new Error('Could not start Edge.');
    const target = await json(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`, { method: 'PUT' });
    const cdp = await connect(target.webSocketDebuggerUrl); await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    assert.equal(await until(cdp, `location.origin !== 'null' && document.readyState === 'complete'`), true, 'page did not load');
    const timestamp = new Date().toISOString();
    const user = { id: 'p24-qa', fullName: 'P24 QA', email: 'p24@local.test', level: 'Level 0', learningTrack: 'foundation', onboardingCompleted: true, studyMinutesPerDay: 20, targetTopikLevel: 2, createdAt: timestamp };
    const old = new Date(Date.now() - 8 * 86400000).toISOString();
    await evaluate(cdp, `(() => { const user=${JSON.stringify(user)}; localStorage.setItem('klearn_users', JSON.stringify([user])); localStorage.setItem('klearn_session', JSON.stringify({userId:user.id,createdAt:${JSON.stringify(timestamp)}})); localStorage.setItem('klearn_progress', JSON.stringify({[user.id]:{skills:{},stats:{streak:2},lessonProgress:{},daily:{date:${JSON.stringify(timestamp.slice(0,10))},tasks:{}}}})); localStorage.setItem('klearn_settings', JSON.stringify({users:{[user.id]:{theme:'dark',language:'vi'}}})); localStorage.setItem('klearn_focus_sessions', JSON.stringify({[user.id]:[{id:'old-focus',status:'completed',completedAt:${JSON.stringify(old)},actualMinutes:10,tasks:[{completed:true}]}]})); location.hash='retention-center'; location.reload(); })()`);
    assert.equal(await until(cdp, `Boolean(document.querySelector('.retention-habit'))`), true, 'retention center did not render');
    assert.equal(await evaluate(cdp, `document.documentElement.dataset.theme === 'dark'`), true, 'dark mode was not preserved');
    assert.equal(await evaluate(cdp, `document.body.textContent.includes('Lấy lại nhịp trong 10 phút')`), true, '7-day reactivation plan missing');
    assert.equal(await evaluate(cdp, `document.querySelectorAll('.retention-reactivation article').length`), 3, 'reactivation plan should have three light steps');

    const results = [];
    for (const width of [360, 768, 1024, 1440, 1920]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 1100, deviceScaleFactor: 1, mobile: false }); await wait(120);
      const metrics = await evaluate(cdp, `(() => { const rect=(node)=>{const value=node?.getBoundingClientRect();return value?{left:value.left,width:value.width,right:value.right}:null}; const app=document.getElementById('app'), nav=document.getElementById('bottomNav'), cards=document.querySelector('.retention-grid'); const buttons=[...document.querySelectorAll('#app button')].filter((node)=>node.getBoundingClientRect().width>0&&node.getBoundingClientRect().height>0); return {width:innerWidth,dark:document.documentElement.dataset.theme==='dark',htmlOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,bodyOverflow:document.body.scrollWidth>document.body.clientWidth,app:rect(app),nav:rect(nav),navPosition:getComputedStyle(nav).position,columns:cards?getComputedStyle(cards).gridTemplateColumns.split(' ').length:0,minTouch:Math.min(...buttons.map((node)=>node.getBoundingClientRect().height)),smallButtons:buttons.filter((node)=>node.getBoundingClientRect().height<44).map((node)=>({text:node.innerText,cls:node.className,height:node.getBoundingClientRect().height}))}; })()`);
      if (metrics.minTouch < 44) console.log('small buttons', JSON.stringify(metrics.smallButtons));
      assert.equal(metrics.dark, true, `dark mode missing at ${width}px`); assert.equal(metrics.htmlOverflow, false, `html overflow at ${width}px`); assert.equal(metrics.bodyOverflow, false, `body overflow at ${width}px`); assert.ok(metrics.minTouch >= 44, `touch target below 44px at ${width}px`);
      if (width >= 1024) { assert.ok(metrics.nav.width >= 240 && metrics.nav.width <= 280, `sidebar invalid at ${width}px`); assert.ok(metrics.app.left >= 240, `content overlaps sidebar at ${width}px`); } else { assert.ok(metrics.app.left < 2, `compact content offset at ${width}px`); assert.ok(metrics.nav.width <= width, `bottom nav overflows at ${width}px`); }
      results.push({ width, sidebar: Math.round(metrics.nav.width), columns: metrics.columns, overflow: metrics.htmlOverflow });
    }

    await evaluate(cdp, `window.KLEARN_APP.setView('home')`); await wait(100);
    assert.equal(await evaluate(cdp, `Boolean(document.querySelector('[data-retention-home]'))`), true, 'Home retention card missing');

    await evaluate(cdp, `window.KLEARN_APP.setView('goal-milestones')`); await wait(100);
    assert.equal(await evaluate(cdp, `document.querySelectorAll('.goal-milestone-list li').length`), 50, 'goal must be split into exactly 50 milestones');
    await evaluate(cdp, `window.KLEARN_APP.setView('weekly-review')`); await wait(100); await evaluate(cdp, `document.querySelector('[data-save-weekly]').click()`); await wait(80);
    assert.equal(await evaluate(cdp, `JSON.parse(localStorage.getItem('klearn_retention')||'{}')['p24-qa'][0].weeklyReviews.length`), 1, 'weekly review did not persist user-scoped');
    await evaluate(cdp, `window.KLEARN_APP.setView('monthly-reflection')`); await wait(100); await evaluate(cdp, `(() => { const form=document.getElementById('monthlyReflectionForm'); form.nextGoal.value='Hoàn thành 10 bài đọc'; form.challenge.value='Nghe hội thoại nhanh'; form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})); })()`); await wait(100);
    assert.equal(await evaluate(cdp, `JSON.parse(localStorage.getItem('klearn_retention')||'{}')['p24-qa'][0].monthlyReflections[0].nextGoal`), 'Hoàn thành 10 bài đọc', 'monthly reflection did not persist');
    await evaluate(cdp, `window.KLEARN_APP.setView('retention-analytics')`); await wait(100); assert.equal(await evaluate(cdp, `document.body.textContent.includes('Không có quyền truy cập')`), true, 'student reached admin analytics');
    console.log(JSON.stringify(results)); console.log('retention responsive: 360, 768, 1024, 1440, 1920, reactivation, 50 milestones, weekly/monthly persistence, dark mode, overflow and admin privacy passed'); cdp.close();
  } finally { browser.kill(); await wait(200); fs.rmSync(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 }); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
