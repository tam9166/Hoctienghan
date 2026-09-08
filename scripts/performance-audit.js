#!/usr/bin/env node
'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const url = process.argv[2] || 'http://127.0.0.1:4173/';
const label = process.argv[3] || 'audit';
const edge = [
  path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
].find((candidate) => candidate && fs.existsSync(candidate));
if (!edge) throw new Error('Microsoft Edge is required for the performance audit.');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function json(target, options) {
  const response = await fetch(target, options);
  if (!response.ok) throw new Error(`${response.status} ${target}`);
  return response.json();
}
async function connect(socketUrl) {
  const socket = new WebSocket(socketUrl); let id = 0; const pending = new Map();
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data); const request = pending.get(message.id);
    if (!request) return; pending.delete(message.id);
    message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result);
  };
  return {
    send(method, params = {}) { return new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })); }); },
    close() { socket.close(); }
  };
}
async function evaluate(cdp, expression) {
  const output = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (output.exceptionDetails) throw new Error(output.exceptionDetails.exception?.description || output.exceptionDetails.text);
  return output.result.value;
}

(async () => {
  const port = 10550 + Math.floor(Math.random() * 200);
  const profile = path.join(os.tmpdir(), `klearn-performance-${process.pid}-${Date.now()}`);
  const browser = childProcess.spawn(edge, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--disable-gpu', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore', windowsHide: true });
  let cdp;
  try {
    let version;
    for (let attempt = 0; attempt < 80 && !version; attempt += 1) { try { version = await json(`http://127.0.0.1:${port}/json/version`); } catch (_) { await wait(100); } }
    if (!version) throw new Error('Could not start Edge.');
    const target = await json(`http://127.0.0.1:${port}/json/new?about%3Ablank`, { method: 'PUT' });
    cdp = await connect(target.webSocketDebuggerUrl);
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Network.enable'); await cdp.send('Performance.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    const startedAt = Date.now();
    await cdp.send('Page.navigate', { url });
    for (let attempt = 0; attempt < 150; attempt += 1) {
      if (await evaluate(cdp, 'document.readyState === "complete"')) break;
      await wait(100);
    }
    await wait(750);
    const wallTimeMs = Date.now() - startedAt;
    const result = await evaluate(cdp, `(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      const resources = performance.getEntriesByType('resource');
      const paint = Object.fromEntries(performance.getEntriesByType('paint').map((item) => [item.name, Math.round(item.startTime)]));
      const byType = resources.reduce((groups, item) => {
        const type = item.initiatorType || 'other';
        const current = groups[type] || { requests: 0, transferBytes: 0, decodedBytes: 0 };
        current.requests += 1; current.transferBytes += item.transferSize || 0; current.decodedBytes += item.decodedBodySize || 0; groups[type] = current;
        return groups;
      }, {});
      return {
        navigation: navigation ? { domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd), loadMs: Math.round(navigation.loadEventEnd), transferBytes: navigation.transferSize || 0, decodedBytes: navigation.decodedBodySize || 0 } : null,
        paint, requests: resources.length + 1,
        transferBytes: resources.reduce((sum, item) => sum + (item.transferSize || 0), navigation?.transferSize || 0),
        decodedBytes: resources.reduce((sum, item) => sum + (item.decodedBodySize || 0), navigation?.decodedBodySize || 0), byType
      };
    })()`);
    const metrics = await cdp.send('Performance.getMetrics');
    const metric = Object.fromEntries(metrics.metrics.map((item) => [item.name, item.value]));
    Object.assign(result, { label, url, wallTimeMs, jsHeapUsedBytes: Math.round(metric.JSHeapUsedSize || 0), jsHeapTotalBytes: Math.round(metric.JSHeapTotalSize || 0), domNodes: Math.round(metric.Nodes || 0), eventListeners: Math.round(metric.JSEventListeners || 0) });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    cdp?.close(); browser.kill();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
