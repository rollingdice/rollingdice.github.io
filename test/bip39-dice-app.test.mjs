// App-seam tests for the BIP39 dice demo: initBip39Dice(root) driven with the
// real page markup from index.astro. The canvas 2D context is a browser API
// and is stubbed at that boundary only — all project code runs for real.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Window } from 'happy-dom';
import { initBip39Dice } from '../src/lib/bip39-dice/app.mjs';
import { deriveSeed } from '../src/lib/bip39-dice/derive.mjs';
import { wordlist } from '@scure/bip39/wordlists/english.js';

const win = new Window();
globalThis.window = win;
globalThis.document = win.document;
globalThis.HTMLCanvasElement = win.HTMLCanvasElement;
if (!globalThis.requestAnimationFrame) {
  globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 5);
}

// Absorbing stub for the canvas-2D browser API (records nothing, throws nothing).
const ctx2d = new Proxy(
  {},
  {
    get(target, prop) {
      if (!(prop in target)) target[prop] = () => {};
      return target[prop];
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  }
);
win.HTMLCanvasElement.prototype.getContext = function () {
  return ctx2d;
};

async function loadPageMarkup() {
  const astro = await readFile(new URL('../src/pages/dice/index.astro', import.meta.url), 'utf8');
  return astro
    .replace(/^---[\s\S]*?---/, '')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<\/?Layout[^>]*>/g, '');
}

async function waitFor(fn, timeout = 5000) {
  const start = Date.now();
  for (;;) {
    if (fn()) return;
    if (Date.now() - start > timeout) throw new Error('waitFor: condition not met in time');
    await new Promise((r) => setTimeout(r, 10));
  }
}

test('initial roll populates the entropy pipeline (roll string, entropy, 12-word seed)', async () => {
  document.body.innerHTML = await loadPageMarkup();
  const root = document.getElementById('bip39-dice-root');
  initBip39Dice(root);

  const rollString = root.querySelector('[data-roll-string]');
  const entropyHex = root.querySelector('[data-entropy-hex]');
  const seedWords = root.querySelector('[data-seed-words]');

  // 100 dice, digits 1-6, read left->right, top->bottom (ADR-0001).
  await waitFor(() => /^[1-6]{100}$/.test(rollString.textContent), 5000);

  // 128 bits of entropy for 12 words, hex-encoded.
  assert.match(entropyHex.textContent, /^[0-9a-f]{32}$/);

  // 12 words, each from the official BIP-39 English wordlist.
  const words = seedWords.textContent.trim().split(/\s+/);
  assert.equal(words.length, 12);
  for (const w of words) assert.ok(wordlist.includes(w), `not a BIP-39 word: ${w}`);

  // Verifiability (ADR-0001): the displayed seed is a pure function of the displayed pattern.
  const derived = await deriveSeed(rollString.textContent, 12);
  assert.equal(derived.mnemonic, seedWords.textContent.trim());
});

test('Roll button starts a new roll and the app recovers after settle', async () => {
  document.body.innerHTML = await loadPageMarkup();
  const root = document.getElementById('bip39-dice-root');
  initBip39Dice(root);

  const rollBtn = root.querySelector('[data-roll]');
  const rollString = root.querySelector('[data-roll-string]');

  await waitFor(() => /^[1-6]{100}$/.test(rollString.textContent), 5000);
  // The initial tumble must settle and re-enable the button.
  await waitFor(() => !rollBtn.disabled, 5000);

  const first = rollString.textContent;
  rollBtn.click();
  await waitFor(() => /^[1-6]{100}$/.test(rollString.textContent) && rollString.textContent !== first, 5000);
  await waitFor(() => !rollBtn.disabled, 5000);
});
