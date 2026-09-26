/* Real-browser P47 QA: node tests/p47-safety-data-integrity.browser.js [url] */
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const edge = [path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')].find((candidate) => candidate && fs.existsSync(candidate));
if (!edge) throw new Error('Microsoft Edge is required for P47 browser QA.');
const baseUrl = process.argv[2] || 'http://127.0.0.1:4173/';
const port = 10320 + Math.floor(Math.random() * 60);
const profile = path.join(os.tmpdir(), `klearn-p47-browser-${process.pid}`);
const browser = childProcess.spawn(edge, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--disable-gpu', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore', windowsHide: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function json(url, options) { const response = await fetch(url, options); if (!response.ok) throw new Error(`${response.status} ${url}`); return response.json(); }
async function connect(url) { const socket = new WebSocket(url); let id = 0; const pending = new Map(); await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; }); socket.onmessage = (event) => { const message = JSON.parse(event.data); const request = pending.get(message.id); if (!request) return; pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); }; return { send(method, params = {}) { return new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })); }); }, close() { socket.close(); } }; }
async function evaluate(cdp, expression) { const output = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (output.exceptionDetails) throw new Error(output.exceptionDetails.exception?.description || output.exceptionDetails.text); return output.result.value; }
async function until(cdp, expression, attempts = 100) { for (let attempt = 0; attempt < attempts; attempt += 1) { if (await evaluate(cdp, expression)) return true; await wait(100); } return false; }

async function startCasServer() {
  const state = { snapshot: null, revision: 0, pulls: [], pushes: [], mutations: new Map(), records: new Map(), recordPulls: [], recordPushes: [], recordMutations: new Map(), recordSequence: 0, recordConflicts: 0 };
  const firstPulls = []; const firstRecordPulls = [];
  const reply = (response, value, status = 200) => { response.writeHead(status, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Content-Type': 'application/json' }); response.end(JSON.stringify(value)); };
  const server = http.createServer((request, response) => {
    if (request.method === 'OPTIONS') return reply(response, {});
    const url = new URL(request.url, 'http://127.0.0.1');
    const clientId = url.searchParams.get('client') || 'unknown';
    if (request.method === 'GET' && url.pathname === '/pull') {
      state.pulls.push({ clientId, revision: state.revision });
      if (state.revision === 0 && firstPulls.length < 2) {
        firstPulls.push(response);
        if (firstPulls.length === 2) firstPulls.splice(0).forEach((waiting) => reply(waiting, { snapshot: null, revision: 0 }));
        return;
      }
      return reply(response, { snapshot: state.snapshot, revision: state.revision });
    }
    if (request.method === 'GET' && url.pathname === '/pull-records') {
      const since = url.searchParams.get('since') || null;
      state.recordPulls.push({ clientId, since });
      const records = [...state.records.values()].filter((row) => !since || row.updated_at >= since);
      if (!state.records.size && firstRecordPulls.length < 2) {
        firstRecordPulls.push(response);
        if (firstRecordPulls.length === 2) firstRecordPulls.splice(0).forEach((waiting) => reply(waiting, { supported: true, records: [] }));
        return;
      }
      return reply(response, { supported: true, records });
    }
    if (request.method === 'POST' && url.pathname === '/push-records') {
      let raw = '';
      request.on('data', (chunk) => { raw += chunk; });
      request.on('end', () => {
        const body = JSON.parse(raw || '{}');
        const options = body.options || {};
        const incoming = Array.isArray(body.records) ? body.records : [];
        state.recordPushes.push({ clientId, mutationId: options.mutationId, records: incoming.map((row) => ({ domain: row.domain, recordId: row.recordId, expectedVersion: row.expectedVersion })) });
        if (state.recordMutations.has(options.mutationId)) return reply(response, { supported: true, status: 'applied', duplicate: true, records: state.recordMutations.get(options.mutationId) });
        const conflicts = [];
        incoming.forEach((row) => { const current = state.records.get(`${row.domain}|${row.recordId}`); if (Number(row.expectedVersion || 0) !== Number(current?.version || 0)) conflicts.push(current || { domain: row.domain, record_id: row.recordId, payload: {}, version: 0 }); });
        if (conflicts.length) { state.recordConflicts += 1; return reply(response, { supported: true, status: 'conflict', records: conflicts }); }
        const applied = incoming.map((row) => {
          const key = `${row.domain}|${row.recordId}`;
          const current = state.records.get(key);
          state.recordSequence += 1;
          const stored = { domain: row.domain, record_id: row.recordId, payload: row.payload || {}, version: Number(current?.version || 0) + 1, device_id: options.deviceId || null, client_updated_at: row.clientUpdatedAt || null, updated_at: new Date(Date.now() + state.recordSequence).toISOString(), deleted_at: row.deletedAt || null };
          state.records.set(key, stored);
          return stored;
        });
        state.recordMutations.set(options.mutationId, applied);
        return reply(response, { supported: true, status: 'applied', records: applied });
      });
      return;
    }
    if (request.method === 'POST' && url.pathname === '/push') {
      let raw = '';
      request.on('data', (chunk) => { raw += chunk; });
      request.on('end', () => {
        const body = JSON.parse(raw || '{}');
        const options = body.options || {};
        state.pushes.push({ clientId, expectedRevision: options.expectedRevision, mutationId: options.mutationId });
        if (state.mutations.has(options.mutationId)) return reply(response, { duplicate: true, revision: state.mutations.get(options.mutationId), snapshot: state.snapshot });
        if (Number(options.expectedRevision) !== state.revision) return reply(response, { conflict: true, revision: state.revision, snapshot: state.snapshot });
        state.snapshot = body.snapshot;
        state.revision += 1;
        state.mutations.set(options.mutationId, state.revision);
        return reply(response, { applied: true, revision: state.revision, snapshot: state.snapshot });
      });
      return;
    }
    return reply(response, { error: 'not-found' }, 404);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, state, url: `http://127.0.0.1:${server.address().port}` };
}

async function openIsolatedClient(rootCdp, appUrl, browserPort) {
  const context = await rootCdp.send('Target.createBrowserContext');
  const created = await rootCdp.send('Target.createTarget', { url: appUrl, browserContextId: context.browserContextId });
  let target;
  for (let attempt = 0; attempt < 60 && !target; attempt += 1) {
    target = (await json(`http://127.0.0.1:${browserPort}/json/list`)).find((item) => item.id === created.targetId);
    if (!target) await wait(100);
  }
  if (!target) throw new Error('Could not open isolated browser client.');
  const cdp = await connect(target.webSocketDebuggerUrl);
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
  assert.equal(await until(cdp, `Boolean(window.KLEARN_APP?.CloudSyncService && document.readyState === 'complete')`), true, 'isolated client did not load');
  return { contextId: context.browserContextId, cdp };
}

(async () => {
  let syncServer; let rootCdp; const isolatedClients = [];
  try {
    let version;
    for (let attempt = 0; attempt < 60 && !version; attempt += 1) { try { version = await json(`http://127.0.0.1:${port}/json/version`); } catch (_) { await wait(100); } }
    if (!version) throw new Error('Could not start Edge.');
    const target = await json(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`, { method: 'PUT' });
    const cdp = await connect(target.webSocketDebuggerUrl); await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    assert.equal(await until(cdp, `Boolean(window.KLEARN_APP?.LocalAuthCredentialService && document.readyState === 'complete')`), true, 'app did not load');

    const authResult = await evaluate(cdp, `(async () => {
      localStorage.clear(); location.hash = 'welcome';
      const app = window.KLEARN_APP;
      const secure = await app.auth.register({ fullName: 'Secure User', email: 'secure@local.test', password: 'Safe-password-47' });
      const stored = JSON.parse(localStorage.getItem('klearn_users'))[0];
      const session = JSON.parse(localStorage.getItem('klearn_session'));
      app.auth.logout();
      const logoutCleared = localStorage.getItem('klearn_session') === null && app.state.currentUser === null;
      let wrongRejected = false; try { await app.auth.login('secure@local.test', 'wrong-password'); } catch (_) { wrongRejected = true; }
      const legacyHash = await app.LocalAuthCredentialService.legacySha256('legacy-password');
      const legacy = { id:'legacy-user', fullName:'Legacy User', email:'legacy@local.test', passwordHash:legacyHash, avatar:'LU', goals:[], level:'Beginner', currentTopikLevel:1, targetTopikLevel:2, onboardingCompleted:true, onboardingStep:'completed', createdAt:new Date().toISOString() };
      localStorage.setItem('klearn_users', JSON.stringify([stored, legacy]));
      const migrated = await app.auth.login('legacy@local.test', 'legacy-password');
      const migratedStored = JSON.parse(localStorage.getItem('klearn_users')).find((item) => item.id === 'legacy-user');
      localStorage.setItem('klearn_session', JSON.stringify({ userId:migrated.id, sessionCreatedAt:'2020-01-01T00:00:00.000Z', sessionExpiresAt:'2020-01-02T00:00:00.000Z' }));
      const expired = app.auth.restoreSession();
      const expiredCleared = expired === null && localStorage.getItem('klearn_session') === null;
      await app.auth.login('legacy@local.test', 'legacy-password');
      return { version:stored.passwordHashVersion, salt:Boolean(stored.passwordSalt), hashIsRaw:stored.passwordHash === 'Safe-password-47', sessionCreated:Boolean(session.sessionCreatedAt), sessionExpires:Boolean(session.sessionExpiresAt), logoutCleared, wrongRejected, migratedVersion:migratedStored.passwordHashVersion, legacyChanged:migratedStored.passwordHash !== legacyHash, expired:expiredCleared };
    })()`);
    assert.deepEqual(authResult, { version: 'pbkdf2-sha256-v1', salt: true, hashIsRaw: false, sessionCreated: true, sessionExpires: true, logoutCleared: true, wrongRejected: true, migratedVersion: 'pbkdf2-sha256-v1', legacyChanged: true, expired: true });

    await evaluate(cdp, `window.KLEARN_ROUTE_LOADER.loadGroup('aiInfra')`);
    const privacyResult = await evaluate(cdp, `(async () => {
      const app=window.KLEARN_APP; let fetches=0; const originalFetch=window.fetch;
      app.PrivacyPreferenceService.update({ aiUsage:false, cloudSync:false, telemetry:false });
      window.fetch=async()=>{fetches+=1;throw new Error('blocked request escaped');};
      const aiDisabled=await window.AIOrchestrationService.request({task:'tutor',input:'test',messages:[{role:'user',content:'test'}],context:{currentTopikLevel:1}});
      let pulls=0,pushes=0; app.state.currentUser.cloudUserId='cloud-user'; app.CloudSyncService.provider={getUserId:()=> 'cloud-user',pull:async()=>{pulls+=1;return {snapshot:null,revision:0};},push:async()=>{pushes+=1;return {revision:1};}};
      const scheduled=app.CloudSyncService.schedule('privacy-test'); const flushed=await app.CloudSyncService.flush('privacy-test');
      app.state.aiOpen=true; app.render(); const ui=Boolean(document.getElementById('aiPrivacySettings')) && document.body.textContent.includes('Trợ lý đang tắt') && document.body.textContent.includes('Hỗ trợ AI đang tắt theo lựa chọn của bạn.');
      window.fetch=originalFetch;
      return {code:aiDisabled.code,fetches,pulls,pushes,scheduled,flushed,ui};
    })()`);
    assert.deepEqual(privacyResult, { code: 'AI_DISABLED_BY_USER', fetches: 0, pulls: 0, pushes: 0, scheduled: false, flushed: false, ui: true });

    const cloudPlaceholderTimestamp = await evaluate(cdp, `(async () => {
      const app=window.KLEARN_APP,original=app.CloudSyncService.hydrate;app.auth.logout();app.CloudSyncService.hydrate=async()=>true;
      const linked=await app.CloudAccountService.attachCloudUser({id:'new-cloud-profile',email:'new-cloud@local.test',user_metadata:{}},{explicitLink:false});
      app.CloudSyncService.hydrate=original;return linked.local.updatedAt;
    })()`);
    assert.equal(cloudPlaceholderTimestamp, '1970-01-01T00:00:00.000Z', 'a new local cloud placeholder must not outrank an existing remote profile');

    syncServer = await startCasServer();
    rootCdp = await connect(version.webSocketDebuggerUrl);
    isolatedClients.push(await openIsolatedClient(rootCdp, baseUrl, port), await openIsolatedClient(rootCdp, baseUrl, port));
    const setupClient = (clientId, payloadKind) => `(async () => {
      localStorage.clear(); const app=window.KLEARN_APP; const uid='shared-local-user';
      const user={id:uid,cloudUserId:'shared-cloud-user',fullName:'Shared User',email:'shared@local.test',avatar:'SU',goals:[],level:'Beginner',currentTopikLevel:1,targetTopikLevel:2,onboardingCompleted:true,onboardingStep:'completed',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
      localStorage.setItem(app.STORAGE_KEYS.users,JSON.stringify([user])); app.state.currentUser=user; app.PrivacyPreferenceService.update({cloudSync:true});
      const now=new Date().toISOString(); const today=now.slice(0,10);
      const progress={lessonProgress:{${payloadKind === 'lesson' ? `'device-a-lesson':{completed:true,score:91,masteryScore:91,updatedAt:now}` : ''}},activityDays:{${payloadKind === 'lesson' ? `[today]:{date:today,activityIds:['lesson:device-a-lesson'],types:['lesson'],count:1,updatedAt:now}` : ''}},stats:{lessonsCompleted:${payloadKind === 'lesson' ? 1 : 0}},skills:{}};
      const cards=${payloadKind === 'word' ? `[{wordId:'device-b-word',id:'device-b-word',korean:'학교',mastery:35,status:'learning',reviewCount:1,correctCount:1,wrongCount:0,nextReview:new Date().toISOString(),updatedAt:new Date().toISOString()}]` : '[]'};
      localStorage.setItem(app.STORAGE_KEYS.progress,JSON.stringify({[uid]:progress})); localStorage.setItem(app.STORAGE_KEYS.srs,JSON.stringify({[uid]:cards}));
      localStorage.setItem(app.STORAGE_KEYS.errors,JSON.stringify({[uid]:${payloadKind === 'lesson' ? `[{id:'device-a-error',questionId:'q-a',type:'grammar',createdAt:now,updatedAt:now}]` : '[]'}}));
      localStorage.setItem(app.STORAGE_KEYS.dictionaryFavorites,JSON.stringify({[uid]:${payloadKind === 'word' ? `[{id:'device-b-favorite',wordId:'device-b-word',createdAt:now,updatedAt:now}]` : '[]'}}));
      const endpoint=${JSON.stringify(syncServer.url)}; const client=${JSON.stringify(clientId)};
      app.CloudSyncService.provider={getUserId:()=> 'shared-cloud-user',pull:async()=>fetch(endpoint+'/pull?client='+client).then((response)=>response.json()),push:async(snapshot,options)=>fetch(endpoint+'/push?client='+client,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({snapshot,options})}).then((response)=>response.json()),pullRecords:async(options={})=>fetch(endpoint+'/pull-records?client='+client+(options.since?'&since='+encodeURIComponent(options.since):'')).then((response)=>response.json()),pushRecords:async(records,options)=>fetch(endpoint+'/push-records?client='+client,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({records,options})}).then((response)=>response.json())}; app.CloudSyncService.revision=0; return true;
    })()`;
    await Promise.all([evaluate(isolatedClients[0].cdp, setupClient('device-a', 'lesson')), evaluate(isolatedClients[1].cdp, setupClient('device-b', 'word'))]);
    const profileMerge = await evaluate(isolatedClients[0].cdp, `(() => {
      const app=window.KLEARN_APP,local=app.state.currentUser;
      app.CloudSyncService.mergeSnapshot({user:{...local,onboardingCompleted:false,studyMinutesPerDay:5,updatedAt:'2020-01-01T00:00:00.000Z'},data:{}});
      const older={onboardingCompleted:app.state.currentUser.onboardingCompleted,studyMinutesPerDay:app.state.currentUser.studyMinutesPerDay};
      app.CloudSyncService.mergeSnapshot({user:{...app.state.currentUser,onboardingCompleted:false,studyMinutesPerDay:30,updatedAt:'2099-01-01T00:00:00.000Z'},data:{}});
      return {...older,newerCompleted:app.state.currentUser.onboardingCompleted,newerMinutes:app.state.currentUser.studyMinutesPerDay};
    })()`);
    assert.deepEqual(profileMerge, { onboardingCompleted: true, studyMinutesPerDay: 20, newerCompleted: false, newerMinutes: 30 }, 'profile merge must use updatedAt instead of always preferring cloud');
    await evaluate(isolatedClients[0].cdp, `(() => { const app=window.KLEARN_APP,user=app.state.currentUser,users=JSON.parse(localStorage.getItem(app.STORAGE_KEYS.users)); user.onboardingCompleted=true; user.studyMinutesPerDay=20; user.updatedAt=new Date().toISOString(); users[users.findIndex((item)=>item.id===user.id)]=user; localStorage.setItem(app.STORAGE_KEYS.users,JSON.stringify(users)); })()`);
    const queuedFlush = await evaluate(isolatedClients[0].cdp, `(async () => {
      const service=window.KLEARN_APP.CloudSyncService,original=service.synchronize,calls=[]; let release;
      service.synchronize=async(reason)=>{calls.push(reason);if(calls.length===1)await new Promise((resolve)=>{release=resolve;});return true;};
      const first=service.flush('first-change');await Promise.resolve();service.flush('second-change');release();await first;
      for(let attempt=0;attempt<30&&calls.length<2;attempt+=1)await new Promise((resolve)=>setTimeout(resolve,10));
      service.synchronize=original;service.inFlight=null;service.pendingReason='';clearTimeout(service.timer);service.timer=null;return calls;
    })()`);
    assert.deepEqual(queuedFlush, ['first-change', 'second-change'], 'a local change during sync must trigger a follow-up flush');
    const syncResults = await Promise.all([evaluate(isolatedClients[0].cdp, `window.KLEARN_APP.CloudSyncService.flush('device-a')`), evaluate(isolatedClients[1].cdp, `window.KLEARN_APP.CloudSyncService.flush('device-b')`)]);
    assert.deepEqual(syncResults, [true, true]);
    const pushCounts = syncServer.state.pushes.reduce((map, entry) => map.set(entry.mutationId, (map.get(entry.mutationId) || 0) + 1), new Map());
    assert.equal(syncServer.state.revision, 2);
    assert.deepEqual(syncServer.state.pushes.map((entry) => entry.expectedRevision).sort(), [0, 0, 1]);
    assert.deepEqual([...pushCounts.values()].sort(), [1, 2], 'conflicted client must retry with the same mutation id');
    assert.equal(Boolean(syncServer.state.snapshot.data.klearn_progress.lessonProgress['device-a-lesson']?.completed), true);
    assert.equal(Boolean((syncServer.state.snapshot.data.klearn_srs || []).find((item) => item.wordId === 'device-b-word')), true);
    assert.ok(syncServer.state.recordConflicts >= 1, 'simultaneous record writes must exercise the conflict path');
    assert.equal(syncServer.state.recordPushes.some((entry) => entry.records.some((row) => row.expectedVersion > 0)), true, 'record conflict must retry against the latest version');
    assert.equal(syncServer.state.records.has('klearn_progress|lesson:device-a-lesson'), true);
    assert.equal(syncServer.state.records.has('klearn_srs|device-b-word'), true);
    assert.equal(syncServer.state.records.has('klearn_errors|device-a-error'), true);
    assert.equal(syncServer.state.records.has('klearn_dictionary_favorites|device-b-favorite'), true);
    assert.equal([...syncServer.state.records.keys()].filter((key) => key.startsWith('klearn_progress|activity:')).length, 1, 'same calendar day must remain one activity record');
    assert.equal(await evaluate(isolatedClients[0].cdp, `window.KLEARN_APP.CloudSyncService.flush('record-reconcile')`), true);
    const reconciled = await evaluate(isolatedClients[0].cdp, `(() => { const app=window.KLEARN_APP; const uid=app.state.currentUser.id; return { lesson:Boolean(JSON.parse(localStorage.getItem(app.STORAGE_KEYS.progress))[uid].lessonProgress['device-a-lesson']?.completed), word:Boolean(JSON.parse(localStorage.getItem(app.STORAGE_KEYS.srs))[uid].find((item)=>item.wordId==='device-b-word')), error:Boolean(JSON.parse(localStorage.getItem(app.STORAGE_KEYS.errors))[uid].find((item)=>item.id==='device-a-error')), favorite:Boolean(JSON.parse(localStorage.getItem(app.STORAGE_KEYS.dictionaryFavorites))[uid].find((item)=>item.id==='device-b-favorite')) }; })()`);
    assert.deepEqual(reconciled, { lesson: true, word: true, error: true, favorite: true });
    await evaluate(isolatedClients[0].cdp, `window.KLEARN_APP.CloudSyncService.flush('record-settle')`);
    const recordWritesBeforeNoop = syncServer.state.recordPushes.length;
    await evaluate(isolatedClients[0].cdp, `window.KLEARN_APP.CloudSyncService.flush('record-noop')`);
    assert.equal(syncServer.state.recordPushes.length, recordWritesBeforeNoop, 'unchanged records must not be written again');
    await evaluate(isolatedClients[0].cdp, `(() => { const app=window.KLEARN_APP; const uid=app.state.currentUser.id; const all=JSON.parse(localStorage.getItem(app.STORAGE_KEYS.progress)); delete all[uid].lessonProgress['device-a-lesson']; localStorage.setItem(app.STORAGE_KEYS.progress,JSON.stringify(all)); })()`);
    assert.equal(await evaluate(isolatedClients[0].cdp, `window.KLEARN_APP.CloudSyncService.flush('record-tombstone')`), true);
    assert.equal(await evaluate(isolatedClients[1].cdp, `window.KLEARN_APP.CloudSyncService.flush('record-tombstone-pull')`), true);
    assert.equal(await evaluate(isolatedClients[1].cdp, `(() => { const app=window.KLEARN_APP; const uid=app.state.currentUser.id; return Boolean(JSON.parse(localStorage.getItem(app.STORAGE_KEYS.progress))[uid].lessonProgress['device-a-lesson']); })()`), false, 'lesson tombstone must remove the record on the other device');
    assert.ok(syncServer.state.records.get('klearn_progress|lesson:device-a-lesson').deleted_at, 'server must retain a tombstone for incremental clients');
    console.log('P47 browser: secure account, privacy enforcement, two-device atomic record sync/conflict retry/no-op hashing/tombstones and legacy CAS compatibility passed');
    cdp.close();
  } finally {
    isolatedClients.forEach((client) => client.cdp.close());
    if (rootCdp) rootCdp.close();
    if (syncServer?.server) {
      syncServer.server.closeAllConnections?.();
      await new Promise((resolve) => syncServer.server.close(resolve));
    }
    browser.kill();
    await Promise.race([new Promise((resolve) => browser.once('exit', resolve)), wait(3000)]);
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 }); }
    catch (error) { if (error?.code !== 'EBUSY') throw error; console.warn('Browser profile cleanup deferred: EBUSY'); }
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
