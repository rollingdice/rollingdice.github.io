// Renderer-seam tests for DiceRenderer2D. window and the canvas 2D context are
// browser APIs and are stubbed at that boundary; the renderer runs for real.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DiceRenderer2D } from '../src/lib/bip39-dice/renderer2d.mjs';

globalThis.window = {
  addEventListener() {},
  removeEventListener() {},
  devicePixelRatio: 1,
};
if (!globalThis.requestAnimationFrame) {
  globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 5);
}
if (!globalThis.cancelAnimationFrame) {
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
}

function makeRecordingCtx() {
  const calls = [];
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    clearRect: () => calls.push('clearRect'),
    fillRect: () => calls.push('fillRect'),
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    translate: () => calls.push('translate'),
    rotate: () => calls.push('rotate'),
    beginPath: () => calls.push('beginPath'),
    rect: () => calls.push('rect'),
    // roundRect deliberately absent: older mobile Safari / Android WebView.
    fill: () => calls.push('fill'),
    stroke: () => calls.push('stroke'),
    arc: () => calls.push('arc'),
    setTransform: () => calls.push('setTransform'),
  };
  return { ctx, calls };
}

async function waitFor(fn, timeout = 5000) {
  const start = Date.now();
  for (;;) {
    if (fn()) return;
    if (Date.now() - start > timeout) throw new Error('waitFor: condition not met in time');
    await new Promise((r) => setTimeout(r, 10));
  }
}

test('renders all 100 dice on canvas engines without ctx.roundRect (older mobile Safari)', async () => {
  const { ctx, calls } = makeRecordingCtx();
  const canvas = {
    clientWidth: 500,
    clientHeight: 500,
    addEventListener() {},
    removeEventListener() {},
    getContext: () => ctx,
  };

  const renderer = new DiceRenderer2D();
  renderer.mount(canvas);
  renderer.setFaces(new Array(100).fill(3));

  let settled = false;
  renderer.onSettled = () => {
    settled = true;
  };
  renderer.roll();
  await waitFor(() => settled, 5000);

  const rectCalls = calls.filter((m) => m === 'rect');
  assert.ok(rectCalls.length >= 100, 'all 100 dice drawn');
  assert.equal(rectCalls.length % 100, 0, 'every animation frame draws all 100 dice');
});
