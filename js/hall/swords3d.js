/*
 * The nine elemental swords in 3D, each with its own magical effects.
 *
 * Sword space: the tip sits at the origin and the sword rises along +y.
 *   0 … L          blade (L = BLADE)
 *   L … L+0.06     crossguard
 *   L+0.06 … +0.3  grip
 *   ≈ L+0.38       pommel
 */
import * as THREE from "three";
import { taperTube, gearShape, rng, v3, TAU, makeCanvas, canvasTexture } from "./util.js";
import { clockDial } from "./textures.js";
import { auraMaterial, runeCircleMaterial, particleMaterial, particles, PARTICLE_MODES, shockwaveMaterial } from "./shaders.js";

const BLADE = 1.05;
const EMBED = 0.12; // how deep the tip is buried in the table

/* ------------------------------------------------------------ materials */

const M = {
  gold: () => new THREE.MeshStandardMaterial({ color: 0xd9ab4f, metalness: 1, roughness: 0.28 }),
  darkGold: () => new THREE.MeshStandardMaterial({ color: 0x9c7430, metalness: 1, roughness: 0.4 }),
  iron: () => new THREE.MeshStandardMaterial({ color: 0x2a2624, metalness: 0.9, roughness: 0.45 }),
  steel: () => new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 1, roughness: 0.22 }),
  silver: () => new THREE.MeshStandardMaterial({ color: 0xe8eef3, metalness: 1, roughness: 0.16 }),
  brass: () => new THREE.MeshStandardMaterial({ color: 0xc9933a, metalness: 1, roughness: 0.32 }),
  copper: () => new THREE.MeshStandardMaterial({ color: 0xb8643a, metalness: 1, roughness: 0.35 }),
  leather: (c) => new THREE.MeshStandardMaterial({ color: c, metalness: 0, roughness: 0.8 }),
  bark: () => new THREE.MeshStandardMaterial({ color: 0x4a3018, metalness: 0, roughness: 0.9 }),
  leaf: () => new THREE.MeshStandardMaterial({ color: 0x3f8f2a, emissive: 0x1a5a0a, emissiveIntensity: 0.4, roughness: 0.6, side: THREE.DoubleSide }),
  rock: () => new THREE.MeshStandardMaterial({ color: 0x6a5c4e, metalness: 0.05, roughness: 0.95, flatShading: true }),
  gem: (c, e = 1) => new THREE.MeshPhysicalMaterial({ color: c, emissive: c, emissiveIntensity: e, metalness: 0, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.05, flatShading: true }),
  crystal: (c = 0xe8fcff) => new THREE.MeshPhysicalMaterial({
    color: c, metalness: 0, roughness: 0.03, transmission: 1, thickness: 0.08, ior: 1.55,
    iridescence: 1, iridescenceIOR: 1.3, emissive: 0x4ad8ff, emissiveIntensity: 0.08, flatShading: true,
  }),
};

function add(parent, geo, mat, pos = [0, 0, 0], rot = [0, 0, 0], scale = 1) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  m.rotation.set(...rot);
  if (Array.isArray(scale)) m.scale.set(...scale); else m.scale.setScalar(scale);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/* ---------------------------------------------------------------- blade */

/**
 * Extruded blade from its right-hand edge profile [[x, y], …] (tip → base).
 * `left` overrides the mirrored left edge for asymmetric blades.
 */
function bladeGeometry(right, { left = null, depth = 0.004, bevel = 0.014, segments = 1, holes = [] } = {}) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  right.forEach(([x, y]) => s.lineTo(x, y));
  (left || right.map(([x, y]) => [-x, y])).slice().reverse().forEach(([x, y]) => s.lineTo(x, y));
  s.closePath();
  holes.forEach(([cx, cy, r]) => { const h = new THREE.Path(); h.absarc(cx, cy, r, 0, TAU, true); s.holes.push(h); });
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.85, bevelSegments: segments, curveSegments: 24 });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
}

/** Profile helper: width function w(y) sampled from tip to base. */
function profile(w, steps = 60) {
  const pts = [];
  for (let i = 1; i <= steps; i++) {
    const y = (i / steps) * BLADE;
    pts.push([w(y), y]);
  }
  return pts;
}

/** Canvas painted in blade space; returns an emissive texture aligned to the blade UVs. */
function bladeTexture(halfWidth, paint) {
  const W = 128, H = 1024;
  const [c, ctx] = makeCanvas(W, H);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  // helpers mapping blade coords → canvas
  const X = (x) => (x / (2 * halfWidth) + 0.5) * W;
  const Y = (y) => (1 - y / BLADE) * H;
  paint(ctx, X, Y, W, H);
  const t = canvasTexture(c, { wrap: false });
  t.repeat.set(1 / (2 * halfWidth), 1 / BLADE);
  t.offset.set(0.5, 0);
  return t;
}

/* --------------------------------------------------------------- grips */

function grip(parent, color, wrap, { y0 = BLADE + 0.05, y1 = BLADE + 0.3, r = 0.022, turns = 8 } = {}) {
  add(parent, new THREE.CylinderGeometry(r * 0.92, r, y1 - y0, 20), M.leather(color), [0, (y0 + y1) / 2, 0]);
  const pts = [];
  for (let i = 0; i <= turns * 12; i++) {
    const a = (i / 12) * TAU, y = y0 + ((y1 - y0) * i) / (turns * 12);
    pts.push(v3(Math.cos(a) * (r + 0.002), y, Math.sin(a) * (r + 0.002)));
  }
  add(parent, taperTube(pts, 0.0045, { tubular: turns * 24, radial: 6 }), wrap);
  add(parent, new THREE.TorusGeometry(r + 0.004, 0.006, 8, 24), wrap, [0, y0, 0], [Math.PI / 2, 0, 0]);
  add(parent, new THREE.TorusGeometry(r + 0.004, 0.006, 8, 24), wrap, [0, y1, 0], [Math.PI / 2, 0, 0]);
}

/* ------------------------------------------------------- the nine blades */

const G = BLADE; // guard height shorthand

const BUILDERS = {
  fire(s) {
    const W = 0.055;
    const right = profile((y) => (y < 0.2 ? W * Math.sin((y / 0.2) * Math.PI / 2) : W) + (y > 0.12 ? 0.011 * Math.sin(y * 34) : 0));
    const lava = bladeTexture(W + 0.02, (ctx, X, Y) => {
      const rand = rng(7);
      ctx.strokeStyle = "#ff7a20";
      ctx.shadowColor = "#ffcc55"; ctx.shadowBlur = 10;
      for (let k = 0; k < 16; k++) {
        let x = (rand() - 0.5) * W * 1.2, y = 0.08 + rand() * 0.9;
        ctx.lineWidth = 1 + rand() * 3;
        ctx.beginPath(); ctx.moveTo(X(x), Y(y));
        for (let i = 0; i < 6; i++) { x = Math.max(-W * 0.8, Math.min(W * 0.8, x + (rand() - 0.5) * 0.03)); y += 0.02 + rand() * 0.03; ctx.lineTo(X(x), Y(y)); }
        ctx.stroke();
      }
      ctx.lineWidth = 5; ctx.strokeStyle = "#ffb040";
      ctx.beginPath(); ctx.moveTo(X(0), Y(0.1)); ctx.lineTo(X(0), Y(BLADE - 0.04)); ctx.stroke();
    });
    s.bladeMat = new THREE.MeshStandardMaterial({ color: 0x2b0a05, metalness: 0.85, roughness: 0.32, emissive: 0xff5a1a, emissiveMap: lava, emissiveIntensity: 1.2 });
    add(s.sword, bladeGeometry(right), s.bladeMat);

    const iron = M.iron(), gold = M.gold();
    add(s.sword, new THREE.CapsuleGeometry(0.022, 0.2, 6, 16), iron, [0, G + 0.02, 0], [0, 0, Math.PI / 2]);
    for (const sx of [-1, 1]) {
      // sweeping flame horns
      add(s.sword, taperTube([v3(sx * 0.1, G + 0.02, 0), v3(sx * 0.17, G + 0.05, 0), v3(sx * 0.23, G - 0.02, 0.01), v3(sx * 0.24, G - 0.12, 0), v3(sx * 0.2, G - 0.2, -0.01)], (t) => 0.024 * (1 - t) + 0.002), iron);
      add(s.sword, taperTube([v3(sx * 0.08, G + 0.03, 0), v3(sx * 0.12, G + 0.1, 0.01), v3(sx * 0.1, G + 0.16, 0), v3(sx * 0.06, G + 0.18, 0)], (t) => 0.014 * (1 - t) + 0.002), gold);
      const tip = add(s.sword, new THREE.OctahedronGeometry(0.018), M.gem(0xff5a14, 2), [sx * 0.2, G - 0.21, 0]);
      s.gems.push(tip);
    }
    s.gems.push(add(s.sword, new THREE.OctahedronGeometry(0.04, 0), M.gem(0xff3a0a, 1.6), [0, G + 0.02, 0], [0, 0, 0], [1, 1.3, 0.8]));
    grip(s.sword, 0x5b1a10, gold);
    // flame-shaped pommel with a crown of spikes
    const pts = [];
    for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push(new THREE.Vector2(Math.sin(t * Math.PI) * 0.042 * (1 - t * 0.45), t * 0.14)); }
    add(s.sword, new THREE.LatheGeometry(pts, 24), iron, [0, G + 0.3, 0]);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      add(s.sword, new THREE.ConeGeometry(0.008, 0.05, 6), gold, [Math.cos(a) * 0.035, G + 0.35, Math.sin(a) * 0.035], [Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6]);
    }
    s.gems.push(add(s.sword, new THREE.IcosahedronGeometry(0.028, 0), M.gem(0xffa020, 2), [0, G + 0.36, 0]));
  },

  water(s) {
    const W = 0.045;
    const right = profile((y) => W * Math.min(1, Math.pow(y / 0.28, 0.6)) * (1 + 0.06 * Math.sin(y * 9)));
    const waves = bladeTexture(W + 0.02, (ctx, X, Y) => {
      ctx.strokeStyle = "#7fe8ff"; ctx.shadowColor = "#bff6ff"; ctx.shadowBlur = 8;
      for (let k = -1; k <= 1; k++) {
        ctx.lineWidth = k ? 2 : 4;
        ctx.beginPath();
        for (let y = 0.08; y < BLADE - 0.02; y += 0.01) {
          const x = k * W * 0.45 + Math.sin(y * 28 + k) * W * 0.18;
          if (y === 0.08) ctx.moveTo(X(x), Y(y)); else ctx.lineTo(X(x), Y(y));
        }
        ctx.stroke();
      }
    });
    s.bladeMat = new THREE.MeshPhysicalMaterial({
      color: 0x7fd8ff, metalness: 0, roughness: 0.05, transmission: 0.75, thickness: 0.05, ior: 1.33,
      attenuationColor: new THREE.Color(0x1a7ad0), attenuationDistance: 0.3, emissive: 0x2a9aff, emissiveMap: waves, emissiveIntensity: 1.2,
    });
    add(s.sword, bladeGeometry(right, { segments: 3, bevel: 0.012 }), s.bladeMat);
    const silver = M.silver();
    add(s.sword, new THREE.CapsuleGeometry(0.018, 0.16, 6, 16), silver, [0, G + 0.02, 0], [0, 0, Math.PI / 2]);
    for (const sx of [-1, 1]) {
      // curling wave crests
      const curl = [v3(sx * 0.09, G + 0.02, 0)];
      for (let i = 0; i <= 30; i++) {
        const t = i / 30, a = t * TAU * 1.15, r = 0.075 * (1 - t * 0.75);
        curl.push(v3(sx * (0.1 + 0.06 + Math.sin(a) * r), G + 0.02 + 0.06 - Math.cos(a) * r, 0));
      }
      add(s.sword, taperTube(curl, (t) => 0.02 * (1 - t) + 0.004, { tubular: 80 }), silver);
      s.gems.push(add(s.sword, new THREE.SphereGeometry(0.014, 16, 12), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.15, iridescence: 1, clearcoat: 1, emissive: 0x88ccff, emissiveIntensity: 0.3 }), [sx * 0.165, G + 0.075, 0]));
    }
    s.gems.push(add(s.sword, new THREE.SphereGeometry(0.035, 24, 16), M.gem(0x1ab0ff, 1.2), [0, G + 0.02, 0], [0, 0, 0], [1, 1.35, 0.7]));
    grip(s.sword, 0x123d5c, silver);
    const drop = [];
    for (let i = 0; i <= 24; i++) { const t = i / 24; drop.push(new THREE.Vector2(Math.sin(t * Math.PI) * 0.04 * Math.pow(1 - t, 0.5), t * 0.12)); }
    add(s.sword, new THREE.LatheGeometry(drop, 24), silver, [0, G + 0.3, 0]);
    s.gems.push(add(s.sword, new THREE.SphereGeometry(0.03, 20, 14), M.gem(0x4ad0ff, 1.4), [0, G + 0.35, 0]));
    // little trident crest
    for (const [x, h] of [[-0.022, 0.05], [0, 0.07], [0.022, 0.05]]) add(s.sword, new THREE.ConeGeometry(0.006, h, 6), silver, [x, G + 0.42 + h / 2, 0]);
  },

  wind(s) {
    const W = 0.034;
    const right = profile((y) => W * Math.min(1, Math.pow(y / 0.42, 0.7)));
    const swirls = bladeTexture(W + 0.02, (ctx, X, Y) => {
      ctx.strokeStyle = "#dff8ff"; ctx.shadowColor = "#ffffff"; ctx.shadowBlur = 8; ctx.lineWidth = 3;
      for (let k = 0; k < 6; k++) {
        const cy = 0.2 + k * 0.14, sx = k % 2 ? 1 : -1;
        ctx.beginPath();
        for (let i = 0; i <= 40; i++) {
          const a = (i / 40) * TAU * 1.4, r = W * 0.6 * (1 - i / 50);
          const x = sx * Math.cos(a) * r, y = cy + Math.sin(a) * r * 1.6;
          if (!i) ctx.moveTo(X(x), Y(y)); else ctx.lineTo(X(x), Y(y));
        }
        ctx.stroke();
      }
    });
    s.bladeMat = new THREE.MeshStandardMaterial({ color: 0xe6eef4, metalness: 1, roughness: 0.14, emissive: 0xbfefff, emissiveMap: swirls, emissiveIntensity: 1 });
    add(s.sword, bladeGeometry(right), s.bladeMat);
    const feather = new THREE.Shape();
    feather.moveTo(0, 0); feather.quadraticCurveTo(0.03, 0.02, 0.13, 0.012); feather.quadraticCurveTo(0.03, -0.016, 0, 0);
    const fgeo = new THREE.ExtrudeGeometry(feather, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 });
    const fmat = new THREE.MeshStandardMaterial({ color: 0xf2f7fb, metalness: 0.75, roughness: 0.3, emissive: 0xaee6ff, emissiveIntensity: 0.12 });
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const m = add(s.sword, fgeo, fmat, [sx * 0.03, G + 0.02 + i * 0.005, (i % 2) * 0.006 - 0.003]);
        m.rotation.z = sx > 0 ? -0.35 + i * 0.16 : Math.PI + 0.35 - i * 0.16;
        m.scale.setScalar(1 - i * 0.07);
      }
    }
    add(s.sword, new THREE.TorusKnotGeometry(0.03, 0.007, 80, 8, 2, 3), M.silver(), [0, G + 0.02, 0]);
    s.gems.push(add(s.sword, new THREE.SphereGeometry(0.018, 16, 12), M.gem(0xd8f6ff, 1.6), [0, G + 0.02, 0]));
    grip(s.sword, 0xdfe8ee, M.silver(), { r: 0.018 });
    // spiral shell pommel
    const spiral = [];
    for (let i = 0; i <= 60; i++) { const t = i / 60, a = t * TAU * 2.2, r = 0.05 * (1 - t); spiral.push(v3(Math.cos(a) * r, G + 0.36 + t * 0.06, Math.sin(a) * r)); }
    add(s.sword, taperTube(spiral, (t) => 0.018 * (1 - t) + 0.003, { tubular: 120 }), M.silver());
    s.gems.push(add(s.sword, new THREE.SphereGeometry(0.02, 16, 12), M.gem(0xbfefff, 1.8), [0, G + 0.33, 0]));
  },

  wood(s) {
    const right = profile((y) => {
      const t = y / BLADE;
      return 0.075 * Math.sin(Math.min(1, t / 0.62) * Math.PI / 2) * (t > 0.62 ? 1 - (t - 0.62) * 0.9 : 1);
    });
    const veins = bladeTexture(0.095, (ctx, X, Y) => {
      ctx.strokeStyle = "#8aff5a"; ctx.shadowColor = "#caff9a"; ctx.shadowBlur = 8;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(X(0), Y(0.04)); ctx.lineTo(X(0), Y(BLADE - 0.02)); ctx.stroke();
      ctx.lineWidth = 2;
      for (let y = 0.12; y < BLADE - 0.1; y += 0.07) {
        for (const sx of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(X(0), Y(y));
          ctx.quadraticCurveTo(X(sx * 0.03), Y(y - 0.01), X(sx * 0.055), Y(y - 0.05));
          ctx.stroke();
        }
      }
    });
    s.bladeMat = new THREE.MeshStandardMaterial({ color: 0x6b4424, metalness: 0, roughness: 0.72, emissive: 0x6dff4a, emissiveMap: veins, emissiveIntensity: 1 });
    add(s.sword, bladeGeometry(right, { segments: 2, bevel: 0.012 }), s.bladeMat);
    const bark = M.bark(), leaf = M.leaf();
    // living vine spiralling up the blade
    const vine = [];
    for (let i = 0; i <= 50; i++) { const t = i / 50, a = t * TAU * 2.4; vine.push(v3(Math.cos(a) * 0.07, 0.3 + t * 0.7, Math.sin(a) * 0.022)); }
    add(s.sword, taperTube(vine, (t) => 0.004 + 0.006 * t, { tubular: 120 }), new THREE.MeshStandardMaterial({ color: 0x2f6a1e, roughness: 0.7, emissive: 0x2a8a10, emissiveIntensity: 0.35 }));
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, 0); leafShape.quadraticCurveTo(0.018, 0.02, 0, 0.05); leafShape.quadraticCurveTo(-0.018, 0.02, 0, 0);
    const leafGeo = new THREE.ShapeGeometry(leafShape);
    vine.forEach((p, i) => { if (i % 7 === 3) add(s.sword, leafGeo, leaf, [p.x, p.y, p.z], [0.4, i, (i % 2 ? 1 : -1) * 0.9]); });
    // gnarled root guard
    const r2 = rng(3);
    for (const sx of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const len = 0.14 + k * 0.03, dz = (k - 1) * 0.02;
        add(s.sword, taperTube([v3(0, G + 0.02, dz * 0.3), v3(sx * len * 0.4, G + 0.05 + k * 0.01, dz), v3(sx * len * 0.8, G + 0.02 - k * 0.02, dz), v3(sx * len, G - 0.05 - k * 0.04, dz * 1.4)], (t) => 0.02 * (1 - t) + 0.003), bark);
        for (let j = 0; j < 3; j++) add(s.sword, leafGeo, leaf, [sx * len * (0.8 + r2() * 0.2), G - 0.04 - k * 0.04, dz], [r2() * 3, r2() * 3, r2() * 3], 1.2);
      }
    }
    add(s.sword, new THREE.SphereGeometry(0.04, 16, 12), bark, [0, G + 0.03, 0], [0, 0, 0], [1.3, 0.8, 0.8]);
    // blossoms
    for (const [x, y] of [[-0.05, G + 0.05], [0.06, G + 0.045], [0, G + 0.07]]) s.gems.push(add(s.sword, new THREE.IcosahedronGeometry(0.012, 0), M.gem(0xff8ad8, 1.2), [x, y, 0.02]));
    grip(s.sword, 0x3d2a14, new THREE.MeshStandardMaterial({ color: 0x3f7a26, roughness: 0.7 }));
    // acorn pommel
    const cup = new THREE.SphereGeometry(0.04, 20, 12, 0, TAU, Math.PI / 2, Math.PI / 2);
    add(s.sword, cup, bark, [0, G + 0.36, 0], [Math.PI, 0, 0]);
    s.gems.push(add(s.sword, new THREE.SphereGeometry(0.036, 20, 16), M.gem(0x3ad45a, 1.2), [0, G + 0.345, 0], [0, 0, 0], [1, 1.25, 1]));
    add(s.sword, new THREE.CylinderGeometry(0.004, 0.006, 0.03), bark, [0, G + 0.39, 0]);
  },

  earth(s) {
    const r = rng(12);
    const jag = profile((y) => {
      const base = 0.075 * Math.min(1, Math.pow(y / 0.25, 0.7));
      return base + (y > 0.1 ? (r() - 0.5) * 0.012 : 0);
    }, 24);
    const cracks = bladeTexture(0.095, (ctx, X, Y) => {
      const rand = rng(44);
      ctx.strokeStyle = "#ffa030"; ctx.shadowColor = "#ffd070"; ctx.shadowBlur = 10;
      for (let k = 0; k < 10; k++) {
        let x = (rand() - 0.5) * 0.08, y = 0.08 + rand() * 0.85;
        ctx.lineWidth = 2 + rand() * 3;
        ctx.beginPath(); ctx.moveTo(X(x), Y(y));
        for (let i = 0; i < 4; i++) { x += (rand() - 0.5) * 0.04; y += 0.02 + rand() * 0.04; ctx.lineTo(X(x), Y(y)); }
        ctx.stroke();
      }
    });
    s.bladeMat = new THREE.MeshStandardMaterial({ color: 0x6f6152, metalness: 0.1, roughness: 0.92, emissive: 0xff9a2a, emissiveMap: cracks, emissiveIntensity: 1.1, flatShading: true });
    add(s.sword, bladeGeometry(jag, { segments: 2, bevel: 0.016, depth: 0.012 }), s.bladeMat);
    const amber = M.gem(0xffa22a, 1.2);
    for (const [x, y, z] of [[0.02, 0.35, 0.018], [-0.03, 0.55, -0.018], [0.01, 0.8, 0.018]]) s.gems.push(add(s.sword, new THREE.OctahedronGeometry(0.014), amber, [x, y, z], [0, 0, 0.4], [1, 1.8, 0.6]));
    const rockMat = M.rock();
    const boulder = (size, seed) => {
      const g = new THREE.DodecahedronGeometry(size, 1);
      const rr = rng(seed), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.8 + rr() * 0.4), p.getY(i) * (0.8 + rr() * 0.4), p.getZ(i) * (0.8 + rr() * 0.4));
      g.computeVertexNormals();
      return g;
    };
    add(s.sword, boulder(0.06, 1), rockMat, [0, G + 0.02, 0], [0, 0, 0], [2.2, 0.7, 0.9]);
    for (const sx of [-1, 1]) add(s.sword, boulder(0.045, sx + 5), rockMat, [sx * 0.15, G + 0.01, 0], [0.3, sx, 0.2], [1, 1.1, 0.9]);
    for (let i = 0; i < 5; i++) s.gems.push(add(s.sword, new THREE.OctahedronGeometry(0.018), amber, [(i - 2) * 0.022, G + 0.07 + (i % 2) * 0.02, 0.02], [0, 0, (i - 2) * 0.25], [0.6, 2.2, 0.6]));
    grip(s.sword, 0x4a3524, M.darkGold(), { r: 0.026 });
    add(s.sword, boulder(0.05, 9), rockMat, [0, G + 0.35, 0]);
    for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; s.gems.push(add(s.sword, new THREE.OctahedronGeometry(0.014), amber, [Math.cos(a) * 0.035, G + 0.39, Math.sin(a) * 0.035], [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5], [0.6, 2, 0.6])); }
  },

  space(s) {
    const W = 0.05;
    const right = profile((y) => W * Math.min(1, Math.pow(y / 0.3, 0.6)) + (y > BLADE - 0.18 && y < BLADE - 0.08 ? 0.012 : 0));
    const cosmos = bladeTexture(W + 0.02, (ctx, X, Y, CW, CH) => {
      const rand = rng(99);
      for (let i = 0; i < 6; i++) {
        const g = ctx.createRadialGradient(rand() * CW, rand() * CH, 2, rand() * CW, rand() * CH, 120 + rand() * 160);
        const hue = ["rgba(170,90,255,", "rgba(80,120,255,", "rgba(255,90,200,"][i % 3];
        g.addColorStop(0, hue + ".7)"); g.addColorStop(1, hue + "0)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH);
      }
      for (let i = 0; i < 500; i++) { ctx.fillStyle = `rgba(255,255,255,${rand()})`; const sz = rand() < 0.05 ? 3 : 1.4; ctx.fillRect(rand() * CW, rand() * CH, sz, sz); }
    });
    cosmos.wrapT = THREE.RepeatWrapping;
    s.bladeMat = new THREE.MeshStandardMaterial({ color: 0x0a0618, metalness: 0.9, roughness: 0.15, emissive: 0xffffff, emissiveMap: cosmos, emissiveIntensity: 1.1 });
    s.scrollMap = cosmos;
    add(s.sword, bladeGeometry(right), s.bladeMat);
    const moonMat = new THREE.MeshStandardMaterial({ color: 0xcab8ff, metalness: 1, roughness: 0.22 });
    const crescent = new THREE.Shape();
    crescent.absarc(0, 0, 0.19, Math.PI * 1.08, Math.PI * 1.92, false);
    crescent.absarc(0, -0.05, 0.16, Math.PI * 1.9, Math.PI * 1.1, true);
    const cg = new THREE.ExtrudeGeometry(crescent, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 2, curveSegments: 40 });
    cg.translate(0, 0, -0.006);
    add(s.sword, cg, moonMat, [0, G + 0.2, 0]);
    for (const sx of [-1, 1]) s.gems.push(add(s.sword, new THREE.OctahedronGeometry(0.016), M.gem(0xffffff, 2.2), [sx * 0.178, G + 0.135, 0], [0, 0, 0.785]));
    s.gems.push(add(s.sword, new THREE.SphereGeometry(0.034, 24, 16), M.gem(0x9b6bff, 1.6), [0, G + 0.03, 0]));
    grip(s.sword, 0x1a1238, moonMat);
    s.gems.push(add(s.sword, new THREE.SphereGeometry(0.045, 32, 20), new THREE.MeshStandardMaterial({ color: 0x6a3ad8, emissive: 0x4a1aa8, emissiveIntensity: 0.8, roughness: 0.4 }), [0, G + 0.37, 0]));
    add(s.sword, new THREE.RingGeometry(0.058, 0.085, 48), new THREE.MeshStandardMaterial({ color: 0xd9ccff, emissive: 0x8a6aff, emissiveIntensity: 0.5, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }), [0, G + 0.37, 0], [Math.PI / 2 - 0.4, 0.2, 0]);
    // orbiting moons
    s.orbit = new THREE.Group();
    s.orbit.position.y = G + 0.37;
    s.sword.add(s.orbit);
    add(s.orbit, new THREE.SphereGeometry(0.012, 16, 12), M.gem(0xbfe0ff, 1.4), [0.12, 0, 0]);
    add(s.orbit, new THREE.SphereGeometry(0.008, 12, 8), M.gem(0xffb0e0, 1.4), [-0.09, 0.03, 0.05]);
  },

  machinery(s) {
    const W = 0.055;
    const right = profile((y) => W * Math.min(1, Math.pow(y / 0.22, 0.7)));
    const left = profile((y) => {
      const base = W * Math.min(1, Math.pow(y / 0.22, 0.7));
      return -(y > 0.55 && y < BLADE - 0.06 ? base + (Math.floor(y / 0.035) % 2 ? 0.014 : 0) : base);
    });
    const circuits = bladeTexture(W + 0.03, (ctx, X, Y) => {
      const rand = rng(5);
      ctx.strokeStyle = "#ffb040"; ctx.fillStyle = "#ffd070"; ctx.shadowColor = "#ffc060"; ctx.shadowBlur = 6; ctx.lineWidth = 2;
      for (let k = 0; k < 14; k++) {
        let x = (rand() - 0.5) * 0.06, y = 0.12 + rand() * 0.85;
        ctx.beginPath(); ctx.moveTo(X(x), Y(y));
        for (let i = 0; i < 3; i++) { if (i % 2) x += (rand() - 0.5) * 0.05; else y += 0.03 + rand() * 0.06; ctx.lineTo(X(x), Y(y)); }
        ctx.stroke();
        ctx.beginPath(); ctx.arc(X(x), Y(y), 4, 0, TAU); ctx.fill();
      }
    });
    s.bladeMat = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 1, roughness: 0.28, emissive: 0xffa030, emissiveMap: circuits, emissiveIntensity: 1 });
    add(s.sword, bladeGeometry(right, { left }), s.bladeMat);
    const brass = M.brass(), copper = M.copper(), steel = M.steel();
    for (let y = 0.25; y < BLADE - 0.05; y += 0.12) for (const x of [-0.03, 0.03]) add(s.sword, new THREE.SphereGeometry(0.006, 10, 8), brass, [x, y, 0.014]);
    add(s.sword, new THREE.BoxGeometry(0.28, 0.035, 0.035), brass, [0, G + 0.02, 0]);
    const gearGeo = (ro, ri, n) => { const g = new THREE.ExtrudeGeometry(gearShape(ro, ri, n, ro * 0.3), { depth: 0.014, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.002, bevelSegments: 1 }); g.translate(0, 0, -0.007); return g; };
    s.spinners = [];
    for (const sx of [-1, 1]) {
      const gm = add(s.sword, gearGeo(0.062, 0.05, 14), brass, [sx * 0.16, G + 0.02, 0]);
      s.spinners.push([gm, sx * 0.8]);
      add(s.sword, new THREE.CylinderGeometry(0.012, 0.012, 0.06, 12), copper, [sx * 0.16, G + 0.02, 0], [Math.PI / 2, 0, 0]);
      add(s.sword, new THREE.CylinderGeometry(0.008, 0.008, 0.09, 10), steel, [sx * 0.08, G + 0.065, 0.02], [0, 0, Math.PI / 2]);
    }
    const mid = add(s.sword, gearGeo(0.045, 0.036, 10), copper, [0, G + 0.02, 0.022]);
    s.spinners.push([mid, -1.2]);
    s.gems.push(add(s.sword, new THREE.SphereGeometry(0.018, 16, 12), M.gem(0xffa020, 2), [0, G + 0.02, 0.03]));
    add(s.sword, new THREE.CylinderGeometry(0.02, 0.02, 0.25, 16), steel, [0, G + 0.175, 0]);
    for (let i = 0; i < 9; i++) add(s.sword, new THREE.TorusGeometry(0.023, 0.005, 8, 20), i % 3 ? steel : copper, [0, G + 0.07 + i * 0.026, 0], [Math.PI / 2, 0, 0]);
    const pg = add(s.sword, gearGeo(0.05, 0.04, 12), brass, [0, G + 0.36, 0]);
    s.spinners.push([pg, 0.5]);
    for (let i = 0; i < 3; i++) add(s.sword, new THREE.TorusGeometry(0.03, 0.003, 6, 24), steel, [0, G + 0.36, 0], [0, (i * Math.PI) / 3, 0]);
    s.gems.push(add(s.sword, new THREE.SphereGeometry(0.02, 16, 12), M.gem(0xffb040, 2.4), [0, G + 0.36, 0]));
  },

  glass(s) {
    const W = 0.05;
    const right = profile((y) => W * Math.min(1, Math.pow(y / 0.22, 0.8)), 12);
    s.bladeMat = M.crystal();
    add(s.sword, bladeGeometry(right, { bevel: 0.011, depth: 0.004 }), s.bladeMat);
    const crystal = M.crystal(0xdaf6ff);
    const prism = (r, h) => {
      const g = new THREE.CylinderGeometry(r, r, h, 6);
      const c = new THREE.ConeGeometry(r, r * 2.5, 6);
      c.translate(0, h / 2 + r * 1.25, 0);
      return [g, c];
    };
    const r3 = rng(8);
    for (const sx of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        const h = 0.08 + r3() * 0.08, r = 0.012 + r3() * 0.01;
        const grp = new THREE.Group();
        grp.position.set(sx * (0.025 + k * 0.012), G + 0.02, (r3() - 0.5) * 0.03);
        grp.rotation.z = -sx * (0.9 + k * 0.28);
        grp.rotation.x = (r3() - 0.5) * 0.4;
        prism(r, h).forEach((g) => add(grp, g, crystal, [0, h / 2, 0]));
        s.sword.add(grp);
      }
    }
    s.gems.push(add(s.sword, new THREE.OctahedronGeometry(0.035), M.gem(0x7ae8ff, 1.2), [0, G + 0.03, 0], [0, 0, 0], [1, 1.4, 0.8]));
    add(s.sword, new THREE.CylinderGeometry(0.02, 0.022, 0.25, 6), crystal, [0, G + 0.175, 0]);
    s.gems.push(add(s.sword, new THREE.CylinderGeometry(0.005, 0.005, 0.24, 8), M.gem(0x9af0ff, 2.5), [0, G + 0.175, 0]));
    s.gems.push(add(s.sword, new THREE.IcosahedronGeometry(0.05, 0), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, metalness: 0.2, iridescence: 1, iridescenceIOR: 1.8, clearcoat: 1, emissive: 0x6ae0ff, emissiveIntensity: 0.4, flatShading: true }), [0, G + 0.37, 0], [0.3, 0.2, 0]));
  },

  time(s) {
    const W = 0.052;
    const right = profile((y) => W * Math.min(1, Math.pow(y / 0.28, 0.65)));
    const numerals = bladeTexture(W + 0.02, (ctx, X, Y) => {
      ctx.fillStyle = "#fff0b8"; ctx.shadowColor = "#ffe08a"; ctx.shadowBlur = 8;
      ctx.font = "700 44px Cinzel, serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ["XII", "III", "VI", "IX"].forEach((n, i) => {
        ctx.save(); ctx.translate(X(0), Y(0.22 + i * 0.16)); ctx.rotate(-Math.PI / 2); ctx.fillText(n, 0, 0); ctx.restore();
      });
      ctx.strokeStyle = "#fff0b8"; ctx.lineWidth = 2;
      for (let y = 0.12; y < BLADE - 0.25; y += 0.025) { ctx.beginPath(); ctx.moveTo(X(-W * 0.8), Y(y)); ctx.lineTo(X(-W * (y * 40 % 5 < 1 ? 0.45 : 0.62)), Y(y)); ctx.stroke(); }
    });
    s.bladeMat = new THREE.MeshStandardMaterial({ color: 0xd8b25a, metalness: 1, roughness: 0.24, emissive: 0xfff1b0, emissiveMap: numerals, emissiveIntensity: 1 });
    add(s.sword, bladeGeometry(right, { holes: [[0, BLADE - 0.16, 0.028]] }), s.bladeMat);
    const gold = M.gold();
    const gear = new THREE.ExtrudeGeometry(gearShape(0.024, 0.019, 10, 0.006), { depth: 0.004, bevelEnabled: false });
    gear.translate(0, 0, -0.002);
    s.spinners = [[add(s.sword, gear, M.brass(), [0, BLADE - 0.16, 0]), 1.2]];
    add(s.sword, new THREE.TorusGeometry(0.03, 0.004, 8, 32), gold, [0, BLADE - 0.16, 0]);
    // clock guard
    add(s.sword, new THREE.BoxGeometry(0.3, 0.022, 0.026), gold, [0, G + 0.02, 0]);
    for (const sx of [-1, 1]) {
      const curl = [];
      for (let i = 0; i <= 30; i++) { const t = i / 30, a = t * TAU, r = 0.03 * (1 - t * 0.7); curl.push(v3(sx * (0.15 + Math.sin(a) * r), G + 0.02 + 0.03 - Math.cos(a) * r, 0)); }
      add(s.sword, taperTube(curl, (t) => 0.01 * (1 - t) + 0.003, { tubular: 60 }), gold);
    }
    add(s.sword, new THREE.CylinderGeometry(0.075, 0.075, 0.03, 48), gold, [0, G + 0.02, 0], [Math.PI / 2, 0, 0]);
    add(s.sword, new THREE.TorusGeometry(0.075, 0.008, 12, 48), gold, [0, G + 0.02, 0]);
    const dialMat = new THREE.MeshStandardMaterial({ map: clockDial(), roughness: 0.4, emissive: 0xffe8b0, emissiveIntensity: 0.25, emissiveMap: null });
    for (const z of [0.016, -0.016]) add(s.sword, new THREE.CircleGeometry(0.068, 48), dialMat, [0, G + 0.02, z], [0, z < 0 ? Math.PI : 0, 0]);
    s.hands = [];
    for (const z of [0.019, -0.019]) {
      const hour = new THREE.Group(), minute = new THREE.Group();
      hour.position.set(0, G + 0.02, z); minute.position.set(0, G + 0.02, z);
      add(hour, new THREE.BoxGeometry(0.006, 0.04, 0.002), M.iron(), [0, 0.018, 0]);
      add(minute, new THREE.BoxGeometry(0.004, 0.058, 0.002), new THREE.MeshStandardMaterial({ color: 0x8a1a2a }), [0, 0.027, 0]);
      s.sword.add(hour, minute);
      s.hands.push(hour, minute);
    }
    s.gems.push(add(s.sword, new THREE.SphereGeometry(0.008, 12, 8), M.gem(0xffe08a, 2), [0, G + 0.02, 0.021]));
    grip(s.sword, 0x2b1f3a, gold);
    // hourglass pommel
    const hg = new THREE.Group();
    hg.position.y = G + 0.37;
    s.sword.add(hg);
    add(hg, new THREE.CylinderGeometry(0.045, 0.045, 0.01, 32), gold, [0, -0.06, 0]);
    add(hg, new THREE.CylinderGeometry(0.045, 0.045, 0.01, 32), gold, [0, 0.06, 0]);
    for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; add(hg, new THREE.CylinderGeometry(0.004, 0.004, 0.12, 8), gold, [Math.cos(a) * 0.038, 0, Math.sin(a) * 0.038]); }
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, transmission: 1, thickness: 0.02, ior: 1.4 });
    add(hg, new THREE.ConeGeometry(0.03, 0.055, 24, 1, true), glassMat, [0, 0.028, 0], [Math.PI, 0, 0]);
    add(hg, new THREE.ConeGeometry(0.03, 0.055, 24, 1, true), glassMat, [0, -0.028, 0]);
    const sandMat = new THREE.MeshStandardMaterial({ color: 0xf5d67a, emissive: 0xf5c040, emissiveIntensity: 0.6 });
    s.sandTop = add(hg, new THREE.ConeGeometry(0.024, 0.04, 24), sandMat, [0, 0.02, 0], [Math.PI, 0, 0]);
    s.sandBottom = add(hg, new THREE.ConeGeometry(0.026, 0.04, 24), sandMat, [0, -0.035, 0]);
    s.gems.push(s.sandTop, s.sandBottom);
  },
};

/* ------------------------------------------------------------- effects */

const PARTICLE_COUNTS = { fire: 90, water: 70, wind: 90, wood: 40, earth: 50, space: 90, machinery: 50, glass: 50, time: 60 };
const AURA_STYLE = { fire: 0, water: 1, wind: 1, wood: 0, earth: 3, space: 2, machinery: 3, glass: 2, time: 0 };

function ringOfNumerals(color) {
  const [c, ctx] = makeCanvas(1024, 64);
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, 1024, 64);
  ctx.fillStyle = color; ctx.font = "700 40px Cinzel, serif"; ctx.textBaseline = "middle";
  const text = "XII · I · II · III · IV · V · VI · VII · VIII · IX · X · XI · ";
  ctx.fillText(text, 8, 34);
  const t = canvasTexture(c);
  return t;
}

/** Adds the element's magical effects; returns objects the update loop animates. */
function buildEffects(s, element, glow) {
  const fx = { mats: [] };
  // aura: two crossed planes hugging the blade
  const aura = auraMaterial(glow, { speed: element === "wind" ? 2.2 : 1, style: AURA_STYLE[element] });
  fx.mats.push(aura);
  for (const ry of [0, Math.PI / 2]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.34, BLADE + 0.1), aura);
    p.position.y = BLADE / 2 + 0.02;
    p.rotation.y = ry;
    p.renderOrder = 2;
    s.sword.add(p);
  }
  // particles
  const pm = particleMaterial(PARTICLE_MODES[element], glow, { size: element === "wood" ? 1.0 : 1.1 });
  fx.mats.push(pm);
  const pts = particles(PARTICLE_COUNTS[element], pm, element.length * 17);
  s.sword.add(pts);

  // element extras
  if (element === "earth") {
    const shard = new THREE.DodecahedronGeometry(0.022, 0);
    fx.rocks = new THREE.InstancedMesh(shard, new THREE.MeshStandardMaterial({ color: 0x7a6a58, roughness: 0.95, flatShading: true, emissive: 0xff8a20, emissiveIntensity: 0.15 }), 9);
    fx.rocks.castShadow = true;
    s.sword.add(fx.rocks);
  }
  if (element === "glass") {
    fx.shards = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.03), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, metalness: 0.3, iridescence: 1, iridescenceIOR: 2, clearcoat: 1, emissive: 0x8ae8ff, emissiveIntensity: 0.3, flatShading: true }), 7);
    s.sword.add(fx.shards);
  }
  if (element === "machinery") {
    const holo = new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    fx.holoMat = holo;
    const g = new THREE.ShapeGeometry(gearShape(0.26, 0.23, 28, 0.21));
    fx.holo = new THREE.Mesh(g, holo);
    fx.holo.rotation.x = -Math.PI / 2;
    fx.holo.position.y = 0.55;
    s.sword.add(fx.holo);
  }
  if (element === "time") {
    const tex = ringOfNumerals("#ffe8a0");
    tex.repeat.set(2, 1);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, opacity: 0.6 });
    fx.timeMat = mat;
    fx.timeRings = [0.35, 0.8].map((y, i) => {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.2 - i * 0.04, 0.2 - i * 0.04, 0.05, 64, 1, true), mat);
      r.position.y = y;
      s.sword.add(r);
      return r;
    });
  }
  if (element === "wind") {
    const helix = [];
    for (let i = 0; i <= 80; i++) { const t = i / 80, a = t * TAU * 3; helix.push(v3(Math.cos(a) * (0.12 + t * 0.08), 0.05 + t * 1.25, Math.sin(a) * (0.12 + t * 0.08))); }
    fx.ribbonMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uIntensity: { value: 0.35 }, uColor: { value: new THREE.Color(glow) } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform float uTime, uIntensity; uniform vec3 uColor; varying vec2 vUv;
        void main(){ float s = smoothstep(0.0, 0.5, fract(vUv.x * 4.0 - uTime * 1.2)) * smoothstep(1.0, 0.6, fract(vUv.x * 4.0 - uTime * 1.2));
          float a = s * smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.85, vUv.x) * 0.5 * uIntensity; gl_FragColor = vec4(uColor * a, a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    fx.ribbon = new THREE.Mesh(taperTube(helix, 0.006, { tubular: 200, radial: 4 }), fx.ribbonMat);
    s.sword.add(fx.ribbon);
  }
  return fx;
}

/* --------------------------------------------------------------- public */

/**
 * Builds one sword planted in the table at `mount` (a point on the tabletop).
 * Returns an object with the scene graph plus update/hover hooks.
 */
export function createSword(element, glow, index) {
  const r = rng(index * 31 + 7);
  const s = {
    element,
    glow,
    gems: [],
    root: new THREE.Group(),     // sits on the tabletop, upright
    tilt: new THREE.Group(),     // leans at the sword's angle
    sword: new THREE.Group(),    // the sword itself, tip at origin
    intensity: 0.35,
    target: 0.35,
  };
  s.root.add(s.tilt);
  s.tilt.add(s.sword);
  s.sword.position.y = -EMBED;

  BUILDERS[element](s);
  s.fx = buildEffects(s, element, glow);

  // varying angles: lean 8–24° in a direction that differs per sword, and twist the blade
  s.tilt.rotation.order = "YXZ";
  s.tilt.rotation.y = r() * TAU;
  s.tilt.rotation.x = (0.14 + r() * 0.28) * (r() < 0.5 ? -1 : 1);
  s.sword.rotation.y = (r() - 0.5) * 1.2;

  // rune circle and shockwave lie flat on the table
  s.runeMat = runeCircleMaterial(glow, 7 + index);
  const rune = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), s.runeMat);
  rune.rotation.x = -Math.PI / 2;
  rune.position.y = 0.004;
  s.root.add(rune);
  s.shockMat = shockwaveMaterial(glow);
  s.shock = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), s.shockMat);
  s.shock.rotation.x = -Math.PI / 2;
  s.shock.position.y = 0.006;
  s.shock.visible = false;
  s.root.add(s.shock);

  // scorched wood and splinters where the blade bit in
  const scorch = new THREE.Mesh(new THREE.CircleGeometry(0.09, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false }));
  scorch.rotation.x = -Math.PI / 2;
  scorch.position.y = 0.002;
  s.root.add(scorch);

  // invisible hit volume for pointer picking
  s.hit = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.14, 1.55, 10), new THREE.MeshBasicMaterial({ visible: false }));
  s.hit.position.y = 0.72;
  s.hit.userData.sword = s;
  s.tilt.add(s.hit);

  s.baseEmissive = s.bladeMat.emissiveIntensity ?? 1;
  s.gemBase = s.gems.map((g) => g.material.emissiveIntensity ?? 1);
  return s;
}

/** Per-frame animation for a sword and its effects. */
export function updateSword(s, t, dt) {
  s.intensity += (s.target - s.intensity) * Math.min(1, dt * 4);
  const k = s.intensity;
  s.fx.mats.forEach((m) => { m.uniforms.uTime.value = t; m.uniforms.uIntensity.value = k; });
  s.runeMat.uniforms.uTime.value = t;
  s.runeMat.uniforms.uIntensity.value = 0.25 + k * 0.9;
  s.bladeMat.emissiveIntensity = s.baseEmissive * (0.35 + k * 0.9);
  s.gems.forEach((g, i) => { if (g.material.emissiveIntensity !== undefined) g.material.emissiveIntensity = s.gemBase[i] * (0.5 + k * 0.8) * (0.9 + 0.1 * Math.sin(t * 3 + i)); });

  if (s.spinners) s.spinners.forEach(([m, speed]) => (m.rotation.z += dt * speed * (0.5 + k)));
  if (s.orbit) s.orbit.rotation.y += dt * (0.8 + k);
  if (s.scrollMap) s.scrollMap.offset.y = 0.5 * Math.sin(t * 0.05) + t * 0.01;
  if (s.hands) s.hands.forEach((h, i) => (h.rotation.z = -(i % 2 ? t * 1.6 : t * 0.14) * (i < 2 ? 1 : -1)));
  if (s.sandTop) {
    const p = (t * 0.12) % 1;
    s.sandTop.scale.set(1 - p * 0.8, 1 - p * 0.8, 1 - p * 0.8);
    s.sandBottom.scale.set(0.2 + p * 0.8, 0.2 + p * 0.8, 0.2 + p * 0.8);
  }
  const fx = s.fx;
  if (fx.rocks) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + t * (0.25 + k * 0.2), rr = 0.2 + (i % 3) * 0.05;
      e.set(t * (0.5 + i * 0.1), t * 0.3 + i, 0);
      q.setFromEuler(e);
      m.compose(v3(Math.cos(a) * rr, 0.15 + (i % 4) * 0.12 + Math.sin(t + i) * 0.03 + k * 0.1, Math.sin(a) * rr), q, v3(1 + (i % 3) * 0.4, 1, 1));
      fx.rocks.setMatrixAt(i, m);
    }
    fx.rocks.instanceMatrix.needsUpdate = true;
  }
  if (fx.shards) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU - t * (0.3 + k * 0.3), rr = 0.24 + (i % 2) * 0.06;
      e.set(t + i, t * 0.7 + i * 2, 0);
      q.setFromEuler(e);
      m.compose(v3(Math.cos(a) * rr, 0.5 + Math.sin(t * 0.8 + i) * 0.25, Math.sin(a) * rr), q, v3(1, 1.6, 1));
      fx.shards.setMatrixAt(i, m);
    }
    fx.shards.instanceMatrix.needsUpdate = true;
  }
  if (fx.holo) {
    fx.holo.rotation.z = t * 0.6;
    fx.holoMat.opacity = 0.12 + k * 0.3;
    fx.holo.position.y = 0.45 + Math.sin(t * 0.8) * 0.1;
  }
  if (fx.timeRings) {
    fx.timeRings[0].rotation.y = t * 0.4;
    fx.timeRings[1].rotation.y = -t * 0.6;
    fx.timeMat.opacity = 0.2 + k * 0.5;
  }
  if (fx.ribbon) {
    fx.ribbonMat.uniforms.uTime.value = t;
    fx.ribbonMat.uniforms.uIntensity.value = k;
    fx.ribbon.rotation.y = t * 1.5;
  }
  if (s.shockStart != null) {
    const p = Math.min(1, (t - s.shockStart) / 1.1);
    s.shock.visible = p < 1;
    s.shockMat.uniforms.uProgress.value = p;
  }
}
