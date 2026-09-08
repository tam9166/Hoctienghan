/* Optional real-browser P54 QA: node tests/product-demo-responsive.browser.js [url] */
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const edge = [path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')].find((candidate) => candidate && fs.existsSync(candidate));
if (!edge) throw new Error('Microsoft Edge is required for responsive browser QA.');
const baseUrl = process.argv[2] || 'http://127.0.0.1:4173/'; const port = 10700 + Math.floor(Math.random() * 80); const profile = path.join(os.tmpdir(), `klearn-p54-browser-${process.pid}`);
const browser = childProcess.spawn(edge, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--disable-gpu', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore', windowsHide: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function json(url, options) { const response = await fetch(url, options); if (!response.ok) throw new Error(`${response.status} ${url}`); return response.json(); }
async function connect(url) { const socket = new WebSocket(url); let id = 0; const pending = new Map(); await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; }); socket.onmessage = (event) => { const message = JSON.parse(event.data); const request = pending.get(message.id); if (!request) return; pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); }; return { send(method, params = {}) { return new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })); }); }, close() { socket.close(); } }; }
async function evaluate(cdp, expression) { const output = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (output.exceptionDetails) throw new Error(output.exceptionDetails.exception?.description || output.exceptionDetails.text); return output.result.value; }
async function until(cdp, expression, attempts = 120) { for (let attempt = 0; attempt < attempts; attempt += 1) { if (await evaluate(cdp, expression)) return true; await wait(100); } return false; }

(async () => {
  let cdp;
  try {
    let version; for (let attempt = 0; attempt < 50 && !version; attempt += 1) { try { version = await json(`http://127.0.0.1:${port}/json/version`); } catch (_) { await wait(100); } } if (!version) throw new Error('Could not start Edge.');
    const target = await json(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(`${baseUrl}#demo`)}`, { method: 'PUT' }); cdp = await connect(target.webSocketDebuggerUrl); await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Network.enable');
    assert.equal(await until(cdp, `document.readyState === 'complete' && Boolean(window.DemoModeService) && Boolean(document.querySelector('[data-demo-start]'))`), true, 'demo landing did not load');
    await evaluate(cdp, `localStorage.setItem('klearn_progress', JSON.stringify({'real-user':{marker:'preserve-me',stats:{lessonsCompleted:2}}})); document.querySelector('[data-demo-start]').click()`);
    assert.equal(await until(cdp, `window.KLEARN_APP?.state?.currentUser?.isDemo === true && location.hash === '#home'`), true, 'demo account did not activate');
    assert.equal(await evaluate(cdp, `window.KLEARN_APP.getUserProgress().stats.lessonsCompleted`), 18);
    assert.equal(await evaluate(cdp, `JSON.parse(localStorage.getItem('klearn_progress'))['real-user'].marker`), 'preserve-me');
    await evaluate(cdp, `window.KLEARN_APP.setView('demo-center')`); assert.equal(await until(cdp, `Boolean(document.querySelector('.demo-flow-list'))`), true, 'demo center did not render');

    const results = [];
    for (const width of [360, 768, 1024, 1440, 1920]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 1100, deviceScaleFactor: 1, mobile: false }); await wait(100);
      const metrics = await evaluate(cdp, `(() => { const flow=document.querySelector('.demo-flow-list'), showcase=document.querySelector('.demo-showcase>div:last-child'); const probe=document.createElement('div'); probe.dataset.technical='true'; document.getElementById('app').append(probe); const result={width:${width},htmlOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,bodyOverflow:document.body.scrollWidth>document.body.clientWidth,presentation:document.documentElement.dataset.presentationMode,technicalHidden:getComputedStyle(probe).display==='none',flowColumns:flow?getComputedStyle(flow).gridTemplateColumns.split(' ').length:0,showcaseCards:showcase?.children.length||0}; probe.remove(); return result; })()`);
      assert.equal(metrics.htmlOverflow, false, `html overflow at ${width}px`); assert.equal(metrics.bodyOverflow, false, `body overflow at ${width}px`); assert.equal(metrics.presentation, 'true'); assert.equal(metrics.technicalHidden, true); assert.equal(metrics.showcaseCards, 6); results.push(metrics);
    }

    await evaluate(cdp, `window.KLEARN_APP.setView('home')`); assert.equal(await until(cdp, `Boolean(document.querySelector('.demo-guide'))`), true, 'guided flow missing');
    await cdp.send('Page.reload', { ignoreCache: true }); assert.equal(await until(cdp, `document.readyState === 'complete' && window.KLEARN_APP?.state?.currentUser?.isDemo === true && Boolean(document.querySelector('.demo-guide'))`), true, 'demo did not survive refresh');
    const swReady = await evaluate(cdp, `(async()=>{if(!('serviceWorker' in navigator))return false;await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller){location.reload();return 'reload';}return true})()`);
    if (swReady === 'reload') assert.equal(await until(cdp, `document.readyState === 'complete' && Boolean(navigator.serviceWorker.controller) && Boolean(window.DemoModeService)`), true, 'service worker did not control demo');
    await cdp.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 }); await cdp.send('Page.reload', { ignoreCache: false });
    assert.equal(await until(cdp, `document.readyState === 'complete' && window.KLEARN_APP?.state?.currentUser?.isDemo === true && Boolean(document.querySelector('.demo-guide'))`, 150), true, 'offline demo reload failed');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await evaluate(cdp, `window.DemoModeService.account.exit()`); assert.equal(await until(cdp, `location.hash === '#welcome' && !window.KLEARN_APP.state.currentUser`), true, 'demo exit failed');
    assert.equal(await evaluate(cdp, `JSON.parse(localStorage.getItem('klearn_progress'))['real-user'].marker`), 'preserve-me');
    assert.equal(await evaluate(cdp, `Boolean(JSON.parse(localStorage.getItem('klearn_progress'))['demo-p54'])`), false);
    console.log(JSON.stringify(results)); console.log('P54 responsive, presentation, isolated data, refresh and offline demo flow passed');
  } finally { try { await cdp?.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }); } catch (_) {} cdp?.close(); browser.kill(); await wait(150); fs.rmSync(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 }); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
