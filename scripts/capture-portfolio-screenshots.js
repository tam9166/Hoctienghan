/*
 * Capture deterministic, privacy-safe portfolio screenshots.
 *
 * Usage:
 *   node scripts/capture-portfolio-screenshots.js http://127.0.0.1:4173/
 *
 * The script uses a temporary Edge profile and synthetic local data. It never
 * reads an existing browser profile or a real learner account.
 */
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const edge = [
  path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
].find((candidate) => candidate && fs.existsSync(candidate));

if (!edge) throw new Error('Microsoft Edge is required to capture portfolio screenshots.');

const baseUrl = process.argv[2] || 'http://127.0.0.1:4173/';
const outputDir = path.resolve(__dirname, '..', 'docs', 'screenshots');
const debugPort = 11800 + Math.floor(Math.random() * 100);
const profile = path.join(os.tmpdir(), `tamhoanq-portfolio-${process.pid}`);
const browser = childProcess.spawn(edge, [
  '--headless=new',
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profile}`,
  '--disable-gpu',
  '--hide-scrollbars',
  '--no-first-run',
  '--no-default-browser-check',
  'about:blank'
], { stdio: 'ignore', windowsHide: true });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

async function connect(url) {
  const socket = new WebSocket(url);
  let id = 0;
  const pending = new Map();
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  };
  return {
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const requestId = ++id;
        pending.set(requestId, { resolve, reject });
        socket.send(JSON.stringify({ id: requestId, method, params }));
      });
    },
    close() { socket.close(); }
  };
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result.value;
}

async function until(cdp, expression, attempts = 120) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await evaluate(cdp, expression)) return true;
    await wait(100);
  }
  return false;
}

async function capture(cdp, fileName) {
  await wait(500);
  const result = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false
  });
  fs.writeFileSync(path.join(outputDir, fileName), Buffer.from(result.data, 'base64'));
}

(async () => {
  let cdp;
  try {
    fs.mkdirSync(outputDir, { recursive: true });
    let version;
    for (let attempt = 0; attempt < 60 && !version; attempt += 1) {
      try {
        version = await getJson(`http://127.0.0.1:${debugPort}/json/version`);
      } catch (_) {
        await wait(100);
      }
    }
    if (!version) throw new Error('Could not start Microsoft Edge.');

    const target = await getJson(
      `http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(baseUrl)}`,
      { method: 'PUT' }
    );
    cdp = await connect(target.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    if (!await until(cdp, `document.readyState === 'complete' && Boolean(document.getElementById('app'))`)) {
      throw new Error('The application did not finish loading.');
    }

    await evaluate(cdp, `(() => {
      localStorage.setItem('klearn_settings', JSON.stringify({ theme: 'light', language: 'vi' }));
      location.hash = 'welcome';
      location.reload();
    })()`);
    if (!await until(cdp, `Boolean(document.querySelector('.welcome-page, .landing-page, .auth-shell')) || (document.getElementById('app')?.innerText?.length || 0) > 150`)) {
      throw new Error('Welcome screen did not render.');
    }
    await capture(cdp, 'landing.png');

    // Sessions expire after seven days, so use the capture time rather than a
    // hard-coded date. All displayed names and progress remain deterministic.
    const timestamp = new Date().toISOString();
    const today = timestamp.slice(0, 10);
    const user = {
      id: 'portfolio-demo',
      fullName: 'Minh Anh',
      email: 'portfolio@local.test',
      level: 'TOPIK I',
      learningTrack: 'topik',
      learningMode: 'topik',
      goals: ['topik'],
      studyMinutesPerDay: 15,
      currentTopikLevel: 1,
      targetTopikLevel: 2,
      onboardingCompleted: true,
      createdAt: timestamp
    };
    const progress = {
      [user.id]: {
        skills: { vocabulary: 72, grammar: 64, listening: 58, speaking: 61, reading: 70, writing: 55 },
        stats: { streak: 7, lessonsCompleted: 12, studyMinutes: 315, vocabularyMastered: 86 },
        lessonProgress: {},
        daily: { date: today, tasks: {} },
        portfolioSample: true
      }
    };
    const settings = { users: { [user.id]: { theme: 'light', language: 'vi' } } };
    await evaluate(cdp, `(() => {
      localStorage.clear();
      localStorage.setItem('klearn_users', ${JSON.stringify(JSON.stringify([user]))});
      localStorage.setItem('klearn_session', ${JSON.stringify(JSON.stringify({ userId: user.id, createdAt: timestamp }))});
      localStorage.setItem('klearn_progress', ${JSON.stringify(JSON.stringify(progress))});
      localStorage.setItem('klearn_settings', ${JSON.stringify(JSON.stringify(settings))});
      location.hash = 'home';
      location.reload();
    })()`);
    if (!await until(cdp, `Boolean(window.KLEARN_APP?.state?.currentUser) && document.getElementById('app').innerText.length > 200`)) {
      throw new Error('Synthetic portfolio session did not render.');
    }

    const screens = [
      ['home', 'home.png'],
      ['lessons', 'learning.png'],
      ['grammar-compare', 'grammar.png'],
      ['topik', 'topik.png'],
      ['ai-coach', 'assistant.png'],
      ['analytics', 'analytics.png'],
      ['profile', 'profile.png']
    ];

    for (const [route, fileName] of screens) {
      await evaluate(cdp, `location.hash = ${JSON.stringify(route)}`);
      if (!await until(cdp, `window.KLEARN_APP?.state?.currentView === ${JSON.stringify(route)} && document.getElementById('app').innerText.length > 120`)) {
        throw new Error(`Route #${route} did not render.`);
      }
      await evaluate(cdp, `scrollTo(0, 0)`);
      await capture(cdp, fileName);
    }

    console.log(`Captured ${screens.length + 1} portfolio screenshots in ${outputDir}`);
  } finally {
    try { cdp?.close(); } catch (_) { /* no-op */ }
    browser.kill();
    await wait(300);
    try {
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 120 });
    } catch (_) {
      /* Edge can release the temporary profile shortly after the process exits. */
    }
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
