import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import childProcess from 'node:child_process';
import { fileURLToPath } from 'node:url';

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(mobileRoot, '..');
const edge = [path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')].find((candidate) => candidate && fs.existsSync(candidate));
if (!edge) throw new Error('Microsoft Edge is required to capture store screenshots.');
const baseUrl = process.argv[2] || 'http://127.0.0.1:4173/';
const plan = JSON.parse(fs.readFileSync(path.join(mobileRoot, 'store', 'screenshots.json'), 'utf8'));
const output = path.join(mobileRoot, 'store');
const port = 11400 + Math.floor(Math.random() * 80);
const profile = path.join(os.tmpdir(), `klearn-store-capture-${process.pid}`);
const browser = childProcess.spawn(edge, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore', windowsHide: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function json(url, options) { const response = await fetch(url, options); if (!response.ok) throw new Error(`${response.status} ${url}`); return response.json(); }
async function connect(url) { const socket = new WebSocket(url); let id = 0; const pending = new Map(); await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; }); socket.onmessage = (event) => { const message = JSON.parse(event.data); const request = pending.get(message.id); if (!request) return; pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); }; return { send(method, params = {}) { return new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })); }); }, close() { socket.close(); } }; }
async function evaluate(cdp, expression) { const output = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (output.exceptionDetails) throw new Error(output.exceptionDetails.exception?.description || output.exceptionDetails.text); return output.result.value; }
async function until(cdp, expression, attempts = 240) { for (let attempt = 0; attempt < attempts; attempt += 1) { if (await evaluate(cdp, expression)) return true; await wait(100); } return false; }

let cdp;
try {
  let version; for (let attempt = 0; attempt < 60 && !version; attempt += 1) { try { version = await json(`http://127.0.0.1:${port}/json/version`); } catch (_) { await wait(100); } }
  if (!version) throw new Error('Could not start Edge.');
  const target = await json(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(`${baseUrl}?store-capture=1`)}`, { method: 'PUT' });
  cdp = await connect(target.webSocketDebuggerUrl); await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  if (!(await until(cdp, `document.readyState==='complete' && Boolean(window.KLEARN_APP)`))) throw new Error('App did not load.');
  const timestamp = new Date().toISOString();
  const user = { id: 'store-demo', fullName: 'Minh Anh', email: 'demo@tamhoanq.local', level: 'TOPIK 2', learningTrack: 'topik', goals: ['topik','conversation'], studyMinutesPerDay: 20, currentTopikLevel: 2, onboardingCompleted: true, createdAt: timestamp };
  await evaluate(cdp, `(()=>{const user=${JSON.stringify(user)};localStorage.clear();localStorage.setItem('klearn_users',JSON.stringify([user]));localStorage.setItem('klearn_session',JSON.stringify({userId:user.id,createdAt:${JSON.stringify(timestamp)}}));localStorage.setItem('klearn_progress',JSON.stringify({[user.id]:{stats:{streak:12,totalXp:1840},lessonProgress:{},skillScores:{vocabulary:72,grammar:64,listening:58,speaking:55},daily:{}}}));localStorage.setItem('klearn_srs',JSON.stringify({[user.id]:[{id:'v-02-01',wordId:'v-02-01',korean:'안녕하세요',meaningVi:'Xin chào',status:'review',reviewCount:3,correctCount:2,mastery:65,nextReview:'2020-01-01T00:00:00.000Z'}]}));localStorage.setItem('klearn_settings',JSON.stringify({schemaVersion:13,users:{[user.id]:{theme:'light',language:'vi'}}}));location.hash='home';location.reload();})()`);
  if (!(await until(cdp, `Boolean(window.KLEARN_APP?.state?.currentUser && document.querySelector('#bottomNav:not(.hidden)'))`))) throw new Error('Demo session did not load.');
  const captured = [];
  for (const item of plan.required) {
    await evaluate(cdp, `KLEARN_APP.setView(${JSON.stringify(item.route)})`);
    if (!(await until(cdp, `KLEARN_APP.state.currentView===${JSON.stringify(item.route)} && document.getElementById('app').children.length>0`))) throw new Error(`${item.route} did not render.`);
    await evaluate(cdp, `scrollTo(0,0)`); await wait(350);
    const image = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
    const destination = path.join(output, item.file); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, Buffer.from(image.data, 'base64'));
    captured.push({ id: item.id, file: path.relative(root, destination).replaceAll('\\', '/'), bytes: fs.statSync(destination).size });
  }
  console.log(JSON.stringify({ status: 'captured', device: plan.device, screenshots: captured }, null, 2));
} finally {
  try { cdp?.close(); } catch {}
  browser.kill(); await wait(300);
  try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 120 }); } catch {}
}
