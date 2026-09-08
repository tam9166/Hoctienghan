/* Full offline reopen QA: node tests/p49-offline-pwa.browser.js */
'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.join(__dirname, '..');
const edge = [path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')].find((candidate) => candidate && fs.existsSync(candidate));
if (!edge) throw new Error('Microsoft Edge is required for offline PWA QA.');
const port = 12200 + Math.floor(Math.random() * 200); const debugPort = port + 300;
const baseUrl = `http://127.0.0.1:${port}/`; const profile = path.join(os.tmpdir(), `klearn-p49-offline-${process.pid}-${Date.now()}`);
const server = childProcess.spawn('python', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore', windowsHide: true });
const browser = childProcess.spawn(edge, ['--headless=new', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, '--disable-gpu', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore', windowsHide: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function json(url, options) { const response = await fetch(url, options); if (!response.ok) throw new Error(`${response.status} ${url}`); return response.json(); }
async function connect(url) { const socket = new WebSocket(url); let id = 0; const pending = new Map(); await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; }); socket.onmessage = (event) => { const message = JSON.parse(event.data); const request = pending.get(message.id); if (!request) return; pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); }; return { send(method, params = {}) { return new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })); }); }, close() { socket.close(); } }; }
async function evaluate(cdp, expression) { const output = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (output.exceptionDetails) throw new Error(output.exceptionDetails.exception?.description || output.exceptionDetails.text); return output.result.value; }
async function until(cdp, expression, attempts = 180) { for (let attempt = 0; attempt < attempts; attempt += 1) { try { if (await evaluate(cdp, expression)) return true; } catch (_) { /* context can be replaced during reload */ } await wait(100); } return false; }

(async () => {
  let cdp;
  try {
    for (let attempt = 0; attempt < 80; attempt += 1) { try { const response = await fetch(baseUrl); if (response.ok) break; } catch (_) { await wait(100); } }
    let version; for (let attempt = 0; attempt < 80 && !version; attempt += 1) { try { version = await json(`http://127.0.0.1:${debugPort}/json/version`); } catch (_) { await wait(100); } }
    if (!version) throw new Error('Could not start Edge.');
    const target = await json(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(baseUrl)}`, { method: 'PUT' }); cdp = await connect(target.webSocketDebuggerUrl); await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    assert.equal(await until(cdp, `Boolean(window.KLEARN_APP && document.readyState==='complete')`), true, 'online app did not load');
    await evaluate(cdp, `(async()=>{ await navigator.serviceWorker.ready; const app=window.KLEARN_APP; localStorage.clear(); const user=await app.auth.register({fullName:'Offline P49',email:'offline-p49@local.test',password:'Safe-password-49'}); app.updateCurrentUser({onboardingCompleted:true,onboardingStep:'completed',learningTrack:'foundation'}); app.saveUserScoped(app.STORAGE_KEYS.backgroundSyncQueue,[{id:'offline-action',type:'completed_lesson',entityId:'hangul-1',payload:{status:'completed'},createdAt:new Date().toISOString()}],100); app.setView('home'); return user.id; })()`);
    if (!(await evaluate(cdp, `Boolean(navigator.serviceWorker.controller)`))) { await cdp.send('Page.reload', { ignoreCache: false }); assert.equal(await until(cdp, `Boolean(window.KLEARN_APP && navigator.serviceWorker.controller)`), true, 'service worker did not take control'); }
    server.kill(); await wait(500);
    await cdp.send('Page.reload', { ignoreCache: true });
    assert.equal(await until(cdp, `Boolean(window.KLEARN_APP && document.readyState==='complete')`), true, 'app did not reopen from PWA cache');
    const result = await evaluate(cdp, `(() => { const app=window.KLEARN_APP; app.setView('home'); return {controlled:Boolean(navigator.serviceWorker.controller),user:app.state.currentUser?.email,view:app.state.currentView,srs:app.getUserSrs().length,queue:window.BackgroundSyncQueueService?.all?.().length||0,text:document.getElementById('app').innerText.slice(0,160)}; })()`);
    assert.equal(result.controlled, true); assert.equal(result.user, 'offline-p49@local.test'); assert.equal(result.view, 'home'); assert.ok(result.srs >= 1000); assert.equal(result.queue, 1); assert.ok(result.text.length > 20);
    console.log(JSON.stringify({ status: 'passed', offlineReopen: result }, null, 2));
  } finally { cdp?.close(); browser.kill(); if (!server.killed) server.kill(); }
})().catch((error) => { console.error(error); browser.kill(); if (!server.killed) server.kill(); process.exitCode = 1; });
