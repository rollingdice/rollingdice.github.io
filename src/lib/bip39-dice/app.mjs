// App controller for the BIP39 dice demo.
// Wires together: shake detection (DeviceMotion + fallback button),
// renderer selection (2D default, 3D dynamic import), word-count toggle,
// online/offline warning, PWA service-worker registration, and the
// on-screen entropy pipeline (roll string -> SHA-256 -> words).

import { DiceRenderer2D } from './renderer2d.mjs';
import { rollGrid, gridToRollString } from './faces.mjs';
import { deriveSeed } from './derive.mjs';
import { GRID_COLS, GRID_ROWS } from './pips.mjs';

const SHAKE_THRESHOLD = 18; // m/s^2 combined

export function initBip39Dice(root) {
  const els = {
    canvasWrap: root.querySelector('[data-dice-wrap]'),
    rendererBtns: root.querySelectorAll('[data-renderer]'),
    strengthBtns: root.querySelectorAll('[data-strength]'),
    rollBtn: root.querySelector('[data-roll]'),
    bannerOnline: root.querySelector('[data-banner-online]'),
    bannerMotion: root.querySelector('[data-banner-motion]'),
    seedPanel: root.querySelector('[data-seed]'),
    seedWords: root.querySelector('[data-seed-words]'),
    entropyHex: root.querySelector('[data-entropy-hex]'),
    rollString: root.querySelector('[data-roll-string]'),
    spinner: root.querySelector('[data-spinner]'),
  };

  let wordCount = 12;
  let faces = [];
  let renderer = null;
  let busy = false;

  function setActive(btn, active) {
    btn.classList.toggle('bg-slate-900', active);
    btn.classList.toggle('text-white', active);
    btn.classList.toggle('bg-slate-100', !active);
    btn.classList.toggle('text-slate-600', !active);
  }

  function onSettled() {
    if (busy) {
      els.spinner.classList.add('hidden');
      els.seedPanel.classList.remove('opacity-40', 'pointer-events-none');
      els.rollBtn.disabled = false;
      busy = false;
    }
  }

  async function makeRenderer(kind) {
    if (renderer) {
      renderer.destroy();
      renderer = null;
    }
    els.canvasWrap.innerHTML = '';
    if (kind === '3d') {
      const { DiceRenderer3D } = await import('./renderer3d.mjs');
      const container = document.createElement('div');
      container.className = 'w-full h-[420px]';
      els.canvasWrap.appendChild(container);
      renderer = new DiceRenderer3D();
      await renderer.mount(container);
    } else {
      const c = document.createElement('canvas');
      c.className = 'w-full h-[420px] block';
      els.canvasWrap.appendChild(c);
      renderer = new DiceRenderer2D();
      renderer.mount(c);
    }
    renderer.onSettled = onSettled;
    if (faces.length) {
      renderer.setFaces(faces);
      renderer.roll();
    }
  }

  function setRenderer(kind) {
    els.rendererBtns.forEach((b) => setActive(b, b.dataset.renderer === kind));
    makeRenderer(kind);
  }

  function setStrength(words) {
    wordCount = words;
    els.strengthBtns.forEach((b) => setActive(b, b.dataset.strength === String(words)));
  }

  async function roll() {
    if (busy) return;
    busy = true;
    els.spinner.classList.remove('hidden');
    els.seedPanel.classList.add('opacity-40', 'pointer-events-none');
    els.rollBtn.disabled = true;

    faces = rollGrid(GRID_COLS, GRID_ROWS);
    renderer.setFaces(faces);
    renderer.roll();

    // Derive immediately so the values are ready; reveal happens in onSettled.
    const result = await deriveSeed(gridToRollString(faces), wordCount);
    els.rollString.textContent = gridToRollString(faces);
    els.entropyHex.textContent = result.entropyHex;
    els.seedWords.textContent = result.mnemonic;
  }

  // --- shake detection ---
  let lastShake = 0;
  function onMotion(e) {
    const a = e.accelerationIncludingGravity;
    if (!a) return;
    const mag = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
    const now = Date.now();
    if (mag > SHAKE_THRESHOLD && now - lastShake > 1200) {
      lastShake = now;
      roll();
    }
  }

  async function requestMotionPermission() {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const res = await DeviceMotionEvent.requestPermission();
        if (res === 'granted') {
          window.addEventListener('devicemotion', onMotion);
        } else {
          els.bannerMotion.classList.remove('hidden');
        }
      } catch {
        els.bannerMotion.classList.remove('hidden');
      }
    } else if ('DeviceMotionEvent' in window) {
      window.addEventListener('devicemotion', onMotion);
    } else {
      els.bannerMotion.classList.remove('hidden');
    }
  }

  // --- online/offline ---
  function updateOnline() {
    if (navigator.onLine) {
      els.bannerOnline.classList.remove('hidden');
    } else {
      els.bannerOnline.classList.add('hidden');
    }
  }

  // --- PWA / service worker ---
  function registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }

  // --- wire events ---
  els.rollBtn.addEventListener('click', roll);
  els.rendererBtns.forEach((b) => b.addEventListener('click', () => setRenderer(b.dataset.renderer)));
  els.strengthBtns.forEach((b) => b.addEventListener('click', () => setStrength(Number(b.dataset.strength))));
  window.addEventListener('online', updateOnline);
  window.addEventListener('offline', updateOnline);

  setRenderer('2d');
  setStrength(12);
  updateOnline();
  requestMotionPermission();
  registerSW();

  // Initial roll so the page isn't empty.
  roll();
}
