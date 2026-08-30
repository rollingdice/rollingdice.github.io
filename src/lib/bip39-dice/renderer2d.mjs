// Canvas-2D dice renderer (default). Draws a 10x10 grid of dice with pips,
// tumbles them for ~1.4s, and settles on the CSPRNG-determined faces (ADR-0003).
// Renderer contract: mount(canvas), setFaces(faces), roll(), destroy(), onSettled.

import { GRID_COLS, GRID_ROWS, PIP_LAYOUT } from './pips.mjs';

export class DiceRenderer2D {
  constructor() {
    this.ctx = null;
    this.faces = null;
    this.dice = [];
    this.raf = 0;
    this.running = false;
  }

  mount(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', this.resize);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    this.running = false;
  }

  resize = () => {
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.faces) this.draw();
  };

  setFaces(faces) {
    this.faces = faces;
  }

  roll() {
    // Initialize each die with a random tumbling state; settle on this.faces.
    this.dice = this.faces.map((face, i) => ({
      face,
      x: Math.random() * this.canvas.clientWidth,
      y: Math.random() * this.canvas.clientHeight,
      vx: (Math.random() - 0.5) * 18,
      vy: (Math.random() - 0.5) * 18,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.5,
      tx: (i % GRID_COLS) * this.cell + this.cell / 2,
      ty: Math.floor(i / GRID_COLS) * this.cell + this.cell / 2,
      t: 0,
      dur: 1200 + Math.random() * 400,
    }));
    this.start = performance.now();
    this.running = true;
    this.tick();
  }

  get cell() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    return Math.min(w / GRID_COLS, h / GRID_ROWS);
  }

  tick = () => {
    const now = performance.now();
    const elapsed = now - this.start;
    let done = true;
    const cell = this.cell;

    for (const d of this.dice) {
      const p = Math.min(elapsed / d.dur, 1);
      // Ease out so dice glide into place.
      const ease = 1 - Math.pow(1 - p, 3);
      d.x = d.tx + (d.x - d.tx) * (1 - ease);
      d.y = d.ty + (d.y - d.ty) * (1 - ease);
      d.rot += d.vrot * (1 - p);
      if (p < 1) done = false;
    }

    this.draw();
    if (!done) {
      this.raf = requestAnimationFrame(this.tick);
    } else {
      this.running = false;
      if (this.onSettled) this.onSettled();
    }
  };

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, w, h);

    const cell = this.cell;
    const size = cell * 0.82;
    ctx.lineWidth = Math.max(1, cell * 0.02);

    for (const d of this.dice) {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);
      // Die body.
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#cbd5e1';
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(-size / 2, -size / 2, size, size, size * 0.15);
      } else {
        // Older mobile Safari/WebView lack roundRect; square pips-free edges still read as dice.
        ctx.rect(-size / 2, -size / 2, size, size);
      }
      ctx.fill();
      ctx.stroke();
      // Pips per face (standard d6 layout).
      this.drawPips(ctx, d.face, size);
      ctx.restore();
    }
  }

  drawPips(ctx, face, size) {
    const r = size * 0.09;
    const o = size * 0.22;
    const spots = PIP_LAYOUT[face];
    ctx.fillStyle = '#0f172a';
    for (const [dx, dy] of spots) {
      ctx.beginPath();
      ctx.arc(dx * o, dy * o, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
