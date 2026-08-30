// Three.js dice renderer (optional; dynamically imported by the app).
// Same renderer contract as renderer2d.mjs: mount, setFaces, roll, destroy,
// onSettled. Builds 100 BoxGeometry dice with pip textures, tumbles them from
// random positions/rotations, and settles on the CSPRNG-determined faces.

import { GRID_COLS, GRID_ROWS, PIP_LAYOUT } from './pips.mjs';

export class DiceRenderer3D {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.dice = [];
    this.raf = 0;
    this.running = false;
    this.clock = null;
  }

  async mount(container) {
    const THREE = await import('three');
    this.THREE = THREE;
    this.container = container;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.camera.position.set(0, 6, 12);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    container.appendChild(this.renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(5, 10, 7);
    this.scene.add(dir);

    // Shared box geometry + per-face pip material textures.
    this.boxGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
    this.pipTextures = {};
    for (let f = 1; f <= 6; f++) {
      this.pipTextures[f] = this.makePipTexture(f);
    }
    this.buildDice();
    this.resize();
    window.addEventListener('resize', this.resize);
    this.startLoop();
  }

  makePipTexture(face) {
    const THREE = this.THREE;
    const size = 128;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#0f172a';
    const r = size * 0.09;
    const o = size * 0.24;
    const spots = PIP_LAYOUT[face];
    for (const [dx, dy] of spots) {
      ctx.beginPath();
      ctx.arc(size / 2 + dx * o, size / 2 + dy * o, r, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  buildDice() {
    const THREE = this.THREE;
    const material = new THREE.MeshStandardMaterial({
      map: null,
      color: 0xffffff,
      roughness: 0.4,
      metalness: 0.0,
    });
    // One material per die face-index so each die can show its settled face
    // on top; simpler: use a materials array per face value.
    for (let i = 0; i < GRID_COLS * GRID_ROWS; i++) {
      // Die uses pip texture on the +Z (top) face based on its settled value;
      // set face 1 as the top initially, updated in settleTo.
      const mats = [
        material, material, material,
        material, material, material,
      ];
      // For the top face (index 2, +Z) use the face-1 pip texture by default.
      mats[2] = new THREE.MeshStandardMaterial({ map: this.pipTextures[1], roughness: 0.4 });
      const mesh = new THREE.Mesh(this.boxGeo, mats);
      this.scene.add(mesh);
      this.dice.push({ mesh, target: null });
    }
  }

  resize = () => {
    if (!this.renderer) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  startLoop() {
    this.clock = new this.THREE.Clock();
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      const dt = this.clock.getDelta();
      let any = false;
      for (const d of this.dice) {
        if (!d.target) continue;
        d.mesh.position.lerp(d.target.position, 1 - Math.pow(0.001, dt));
        d.mesh.rotation.x += (d.target.rotation.x - d.mesh.rotation.x) * (1 - Math.pow(0.001, dt));
        d.mesh.rotation.y += (d.target.rotation.y - d.mesh.rotation.y) * (1 - Math.pow(0.001, dt));
        d.mesh.rotation.z += (d.target.rotation.z - d.mesh.rotation.z) * (1 - Math.pow(0.001, dt));
        if (d.mesh.position.distanceTo(d.target.position) > 0.001) any = true;
      }
      this.renderer.render(this.scene, this.camera);
      if (!any && this.running) {
        // settled
        this.running = false;
        if (this.onSettled) this.onSettled();
      }
    };
    loop();
  }

  setFaces(faces) {
    this.faces = faces;
    // Assign target layout: 10x10 grid centered, spacing 1.05.
    const spacing = 1.05;
    const offX = (GRID_COLS - 1) * spacing / 2;
    const offZ = (GRID_ROWS - 1) * spacing / 2;
    for (let i = 0; i < this.dice.length; i++) {
      const col = i % GRID_COLS;
      const row = Math.floor(i / GRID_COLS);
      const face = faces[i];
      const topMat = this.dice[i].mesh.material[2];
      topMat.map = this.pipTextures[face];
      topMat.needsUpdate = true;
      this.dice[i].target = {
        position: new this.THREE.Vector3(col * spacing - offX, 0, row * spacing - offZ),
        rotation: new this.THREE.Euler(0, 0, 0),
      };
    }
  }

  roll() {
    const THREE = this.THREE;
    for (const d of this.dice) {
      d.mesh.position.set(
        (Math.random() - 0.5) * 14,
        2 + Math.random() * 6,
        (Math.random() - 0.5) * 14
      );
      d.mesh.rotation.set(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);
    }
    this.running = true;
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }
    for (const d of this.dice) {
      this.scene.remove(d.mesh);
    }
    this.dice = [];
  }
}
