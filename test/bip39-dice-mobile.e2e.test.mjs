// Mobile-emulation e2e tests for the BIP39 dice demo.
//
// Runs the real page (Astro dev server) in a real browser engine under mobile
// device emulation — iPhone 14 Safari (WebKit) and Pixel 7 Chrome (Chromium) —
// so mobile-only failures fail loud here, not just in the happy-dom shim:
//   * missing ctx.roundRect on older mobile Safari / Android WebView
//   * null-element crash during init
//   * touch re-roll / settle recovery
//
// Server: reuses a running dev server on 127.0.0.1:4321 if present (the
// session default), otherwise boots its own `astro dev` on a free port.
// Set DICE_TEST_BASE_URL to run against a deployed instance instead.
//
// Requires: `npm install --include=dev` and `npx playwright install chromium webkit`.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import net from 'node:net';
import { chromium, webkit, devices } from 'playwright';

import { deriveSeed } from '../src/lib/bip39-dice/derive.mjs';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const ASTRO_CLI = fileURLToPath(new URL('../node_modules/astro/astro.js', import.meta.url));
const SHOT_DIR = fileURLToPath(new URL('./screenshots/', import.meta.url));
const ROLL_RE = '^[1-6]{100}$';

const DEVICE_CANDIDATES = {
  'iPhone 14 Safari': ['iPhone 14', 'iPhone 13', 'iPhone 12'],
  'Pixel 7 Chrome': ['Pixel 7', 'Pixel 5', 'Pixel 4'],
};

let baseUrl = process.env.DICE_TEST_BASE_URL || '';
let serverProc = null;

function pickDevice(key) {
  for (const name of DEVICE_CANDIDATES[key]) {
    if (devices[name]) return { label: name, ...devices[name] };
  }
  throw new Error(`no Playwright device preset for ${key}`);
}

async function isUp(url, timeoutMs = 20000) {
  const start = Date.now();
  for (;;) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // not up yet
    }
    if (Date.now() - start > timeoutMs) return false;
    await new Promise((r) => setTimeout(r, 250));
  }
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

before(async () => {
  await mkdir(SHOT_DIR, { recursive: true });
  if (baseUrl) return;
  if (await isUp('http://127.0.0.1:4321/dice/')) {
    baseUrl = 'http://127.0.0.1:4321';
    return;
  }
  const port = await freePort();
  serverProc = spawn(process.execPath, [ASTRO_CLI, 'dev', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: REPO_ROOT,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  serverProc.on('error', (e) => (stderr += `spawn error: ${e}\n`));
  serverProc.stderr.on('data', (d) => (stderr += d));
  baseUrl = `http://127.0.0.1:${port}`;
  if (!(await isUp(`${baseUrl}/dice/`))) {
    throw new Error(`astro dev did not come up on ${baseUrl}. stderr: ${stderr.slice(-2000)}`);
  }
});

after(() => {
  if (serverProc) serverProc.kill();
});

async function openDicePage(browser, deviceKey, initScripts = []) {
  const device = pickDevice(deviceKey);
  const context = await browser.newContext({ ...device });
  // The app registers a cache-only service worker; keep e2e runs deterministic.
  await context.route('**/sw.js', (route) => route.fulfill({ status: 404, body: 'service worker disabled in tests' }));
  for (const fn of initScripts) await context.addInitScript(fn);
  const page = await context.newPage();
  await page.goto(`${baseUrl}/dice/`, { waitUntil: 'domcontentloaded' });
  return { context, page };
}

async function waitForInitialRoll(page) {
  await page.waitForFunction(
    (re) => re.test(document.querySelector('[data-roll-string]')?.textContent ?? ''),
    new RegExp(ROLL_RE),
    { timeout: 15000 }
  );
  // Settle completes when onSettled re-enables the Roll button.
  await page.waitForFunction(() => {
    const b = document.querySelector('[data-roll]');
    return b && !b.disabled;
  }, null, { timeout: 15000 });
}

// Counts the white die bodies on the canvas via connected components (4-connectivity
// flood fill on an exact-white mask). Each die face is a #ffffff rounded rect with
// dark pips inside; the background is #f8fafc (r=248 < 250), so the pure-white mask
// isolates die interiors — one connected component per die. A crashed draw loop
// (e.g. missing ctx.roundRect guard) leaves zero components. Area filter drops
// anti-aliasing specks. Exact, deterministic: asserts the grid really is 10x10.
async function countDieBodies(page) {
  return page.evaluate(() => {
    const c = document.querySelector('#bip39-dice-root canvas');
    if (!c) return { error: 'no canvas' };
    const ctx = c.getContext('2d');
    const { width: w, height: h } = c;
    const data = ctx.getImageData(0, 0, w, h).data;
    const n = w * h;
    const isWhite = new Uint8Array(n);
    let dark = 0;
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      const r = data[o], g = data[o + 1], b = data[o + 2];
      isWhite[i] = r >= 250 && g >= 250 && b >= 250 ? 1 : 0;
      if (r < 70 && g < 70 && b < 70) dark++;
    }
    const seen = new Uint8Array(n);
    const stack = [];
    let components = 0;
    for (let i = 0; i < n; i++) {
      if (!isWhite[i] || seen[i]) continue;
      let area = 0;
      stack.push(i);
      seen[i] = 1;
      while (stack.length) {
        const p = stack.pop();
        area++;
        const x = p % w;
        if (x > 0) { const q = p - 1; if (isWhite[q] && !seen[q]) { seen[q] = 1; stack.push(q); } }
        if (x < w - 1) { const q = p + 1; if (isWhite[q] && !seen[q]) { seen[q] = 1; stack.push(q); } }
        if (p >= w) { const q = p - w; if (isWhite[q] && !seen[q]) { seen[q] = 1; stack.push(q); } }
        if (p < n - w) { const q = p + w; if (isWhite[q] && !seen[q]) { seen[q] = 1; stack.push(q); } }
      }
      if (area >= 30) components++; // ignore anti-aliasing specks
    }
    return { w, h, components, dark, total: n };
  });
}

function assertDiceGrid(counted, ctxLabel) {
  assert.ok(!counted.error, `${ctxLabel}: ${counted.error ?? 'n/a'}`);
  assert.equal(counted.components, 100, `${ctxLabel}: expected exactly 100 die bodies, found ${counted.components}`);
  const darkFrac = counted.dark / counted.total;
  assert.ok(darkFrac > 0.005, `${ctxLabel}: expected pips painted, dark=${(darkFrac * 100).toFixed(2)}%`);
}

test('iPhone 14 Safari emulation: initial roll paints 100 dice and derives a verifiable 12-word seed', { timeout: 60000 }, async () => {
  const browser = await webkit.launch();
  try {
    const { context, page } = await openDicePage(browser, 'iPhone 14 Safari');
    await waitForInitialRoll(page);

    const roll = await page.textContent('[data-roll-string]');
    const entropyHex = (await page.textContent('[data-entropy-hex]')).trim();
    const words = (await page.textContent('[data-seed-words]')).trim().split(/\s+/);

    assert.match(roll, /^[1-6]{100}$/);
    assert.match(entropyHex, /^[0-9a-f]{32}$/);
    assert.equal(words.length, 12);

    // ADR-0001 verifiability: displayed seed is a pure function of the displayed roll string.
    const { mnemonic } = await deriveSeed(roll, 12);
    assert.equal(mnemonic, words.join(' '));

    const stats = await countDieBodies(page);
    assertDiceGrid(stats, 'iPhone 14');

    await page.screenshot({ path: path.join(SHOT_DIR, 'dice-iphone14-safari.png'), fullPage: true });
    await context.close();
  } finally {
    await browser.close();
  }
});

test('Pixel 7 Chrome emulation: Roll button re-rolls and the app recovers after settle', { timeout: 60000 }, async () => {
  const browser = await chromium.launch();
  try {
    const { context, page } = await openDicePage(browser, 'Pixel 7 Chrome');
    await waitForInitialRoll(page);
    const first = await page.textContent('[data-roll-string]');

    await page.click('[data-roll]');
    await page.waitForFunction(
      ([re, prev]) => {
        const t = document.querySelector('[data-roll-string]')?.textContent ?? '';
        return re.test(t) && t !== prev;
      },
      [new RegExp(ROLL_RE), first],
      { timeout: 15000 }
    );
    await page.waitForFunction(() => {
      const b = document.querySelector('[data-roll]');
      return b && !b.disabled;
    }, null, { timeout: 15000 });

    const stats = await countDieBodies(page);
    assertDiceGrid(stats, 'Pixel 7 after re-roll');

    await page.screenshot({ path: path.join(SHOT_DIR, 'dice-pixel7-chrome.png'), fullPage: true });
    await context.close();
  } finally {
    await browser.close();
  }
});

test('mobile emulation: dice still paint when ctx.roundRect is missing (older mobile Safari / Android WebView)', { timeout: 60000 }, async () => {
  const browser = await chromium.launch();
  try {
    const { context, page } = await openDicePage(browser, 'Pixel 7 Chrome', [
      () => {
        delete CanvasRenderingContext2D.prototype.roundRect;
      },
    ]);
    await waitForInitialRoll(page);

    const roll = await page.textContent('[data-roll-string]');
    assert.match(roll, /^[1-6]{100}$/);

    const stats = await countDieBodies(page);
    assertDiceGrid(stats, 'roundRect removed');
    await context.close();
  } finally {
    await browser.close();
  }
});

// Regression for the real-device bug: over http://<LAN-IP> (an insecure context)
// crypto.subtle is undefined, so deriveSeed's SHA-256 threw and the roll string,
// entropy, and seed fields stayed empty even though the dice rendered. The app
// must derive via a pure-JS fallback so the pipeline populates anywhere.
test('insecure context (no crypto.subtle): pipeline still populates roll string, entropy, and seed', { timeout: 60000 }, async () => {
  const browser = await chromium.launch();
  try {
    const { context, page } = await openDicePage(browser, 'Pixel 7 Chrome', [
      () => {
        Object.defineProperty(window.crypto, 'subtle', { value: undefined, configurable: true });
      },
    ]);
    await waitForInitialRoll(page);

    const roll = (await page.textContent('[data-roll-string]')).trim();
    const entropy = (await page.textContent('[data-entropy-hex]')).trim();
    const seed = (await page.textContent('[data-seed-words]')).trim();

    assert.match(roll, /^[1-6]{100}$/);
    assert.match(entropy, /^[0-9a-f]{32}$/);
    assert.equal(seed.split(/\s+/).length, 12);

    const { mnemonic } = await deriveSeed(roll, 12);
    assert.equal(mnemonic, seed);

    const stats = await countDieBodies(page);
    assertDiceGrid(stats, 'insecure context');
    await context.close();
  } finally {
    await browser.close();
  }
});

// The shake/motion feature is gated behind a secure context: over http://<LAN-IP>
// DeviceMotionEvent is undefined, so the app shows the motion banner and the
// shake path is disabled. This test asserts that the banner reflects the real
// cause (insecure context) — not just a generic "permission denied" message.
test('insecure context: motion banner explains the secure-context limitation', { timeout: 60000 }, async () => {
  const browser = await chromium.launch();
  try {
    // Simulate the phone's insecure context: on http://<LAN-IP> the browser
    // hides DeviceMotionEvent entirely and crypto.subtle is undefined.
    const { context, page } = await openDicePage(browser, 'Pixel 7 Chrome', [
      () => {
        Object.defineProperty(window.crypto, 'subtle', { value: undefined, configurable: true });
        Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
        try {
          delete window.DeviceMotionEvent;
        } catch {
          // Some engines won't let us delete it; the isSecureContext=false override
          // is the part that matters for the banner logic.
        }
      },
    ]);
    await waitForInitialRoll(page);

    const banner = await page.textContent('[data-banner-motion]');
    assert.ok(
      /secure|https/i.test(banner),
      `motion banner should explain the secure-context limitation, got: ${JSON.stringify(banner)}`
    );
    // The Roll button must still work as the fallback (ADR-0002: warns, not blocks).
    assert.ok(!(await page.isDisabled('[data-roll]')), 'Roll button must stay enabled as fallback');
    await context.close();
  } finally {
    await browser.close();
  }
});

// On a secure context, DeviceMotionEvent exists and the motion banner is hidden
// (shake is the primary input, not the fallback).
test('secure context: motion banner hidden when DeviceMotionEvent is available', { timeout: 60000 }, async () => {
  const browser = await chromium.launch();
  try {
    // Playwright's Pixel 7 context is a secure context (http://127.0.0.1).
    const { context, page } = await openDicePage(browser, 'Pixel 7 Chrome');
    await waitForInitialRoll(page);

    const bannerHidden = await page.evaluate(() => {
      const b = document.querySelector('[data-banner-motion]');
      return b ? b.classList.contains('hidden') : null;
    });
    assert.equal(bannerHidden, true, 'motion banner should be hidden in a secure context');
    await context.close();
  } finally {
    await browser.close();
  }
});
