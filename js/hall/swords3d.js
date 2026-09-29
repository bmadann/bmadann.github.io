/*
 * The nine elemental ultra greatswords, each with its own magic.
 *
 * Sword space: the tip sits at the origin and the sword runs up +y toward the
 * pommel. Blades are 1.75–2.1 m long; every sword has its own blade outline,
 * guard, grip length and pommel. Static parts are merged per material so a
 * sword costs a handful of draw calls; moving parts (gears, hands, ribbons)
 * stay separate.
 *
 * Scene graph:  root (on the tabletop) → tilt (leans outward) → slot (slides
 * out of the table on hover) → sword (tip buried in the wood).
 */
import * as THREE from "three";
import { taperTube, gearShape, rng, v3, TAU, makeCanvas, canvasTexture, MergeBuilder, mat as xf } from "./util.js";
import { clockDial } from "./textures.js";
import {
  auraMaterial, particleMaterial, particles, PARTICLE_MODES, shockwaveMaterial, flameMaterial,
  sigilMaterial, SIGIL_STYLE, ribbonMaterial, nebulaMaterial, prismRayMaterial,
} from "./shaders.js";

const EMBED = 0.16; // how deep the tip is buried in the table

/* ------------------------------------------------------------ materials */

const M = {
  metal: (color, roughness = 0.25, extra = {}) => new THREE.MeshStandardMaterial({ color, metalness: 1, roughness, ...extra }),
  matte: (color, roughness = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, metalness: 0, roughness, ...extra }),
  gem: (c, e = 1) => new THREE.MeshPhysicalMaterial({ color: c, emissive: c, emissiveIntensity: e, metalness: 0, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05, flatShading: true }),
  crystal: (c = 0xe8fcff) => new THREE.MeshPhysicalMaterial({
    color: c, metalness: 0, roughness: 0.03, transmission: 1, thickness: 0.12, ior: 1.55,
    iridescence: 1, iridescenceIOR: 1.3, emissive: 0x4ad8ff, emissiveIntensity: 0.06, flatShading: true,
  }),
};

/* --------------------------------------------------------- blade forging */

/** Width profile sampled from tip to base: fn(y) → x. */
function profile(L, fn, steps = 90) {
  const pts = [];
  for (let i = 1; i <= steps; i++) {
    const y = (i / steps) * L;
    pts.push([fn(y), y]);
  }
  return pts;
}

/** Extruded outline from right/left edge profiles (tip → base), with optional holes. */
function bladeGeometry(right, { left = null, tip = [0, 0], depth = 0.004, bevel = 0.014, segments = 1, holes = [] } = {}) {
  const s = new THREE.Shape();
  s.moveTo(tip[0], tip[1]);
  right.forEach(([x, y]) => s.lineTo(x, y));
  (left || right.map(([x, y]) => [-x, y])).slice().reverse().forEach(([x, y]) => s.lineTo(x, y));
  s.closePath();
  holes.forEach((h) => s.holes.push(h));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: segments, curveSegments: 20 });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
}

const HOLE = {
  circle(cx, cy, r) { const p = new THREE.Path(); p.absarc(cx, cy, r, 0, TAU, true); return p; },
  ellipse(cx, cy, rx, ry) { const p = new THREE.Path(); p.absellipse(cx, cy, rx, ry, 0, TAU, true, 0); return p; },
  star(cx, cy, ro, ri, n = 5) {
    const pts = [];
    for (let i = 0; i < n * 2; i++) { const a = Math.PI / 2 + (i * Math.PI) / n, r = i % 2 ? ri : ro; pts.push(new THREE.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r)); }
    return new THREE.Path(pts.reverse());
  },
  fromShape(shape, cx, cy) { return new THREE.Path(shape.getPoints(6).map((p) => new THREE.Vector2(p.x + cx, p.y + cy)).reverse()); },
  teardrop(cx, cy, w, h) {
    const p = new THREE.Path();
    p.moveTo(cx, cy + h / 2);
    p.quadraticCurveTo(cx - w, cy - h * 0.1, cx, cy - h / 2);
    p.quadraticCurveTo(cx + w, cy - h * 0.1, cx, cy + h / 2);
    return p;
  },
  crescent(cx, cy, r) {
    const p = new THREE.Path();
    p.absarc(cx, cy, r, Math.PI * 0.15, Math.PI * 0.85, false);
    p.absarc(cx, cy + r * 0.45, r * 0.8, Math.PI * 0.8, Math.PI * 0.2, true);
    return new THREE.Path(p.getPoints(24).reverse());
  },
};

/**
 * Two-tone blade: a bright, sharply bevelled edge layer with a thicker,
 * darker core inset inside it, the way a forged greatsword shows its hone line.
 */
function forgeBlade(c, { right, left, tip = [0, 0], edge = 0.02, depth = 0.024, coreMat, edgeMat, holes = [], coreFrom = 0.08 }) {
  const L = left || right.map(([x, y]) => [-x, y]);
  c.part(bladeGeometry(right, { left: L, tip, depth: 0.003, bevel: depth * 0.45, segments: 1, holes }), edgeMat);
  const inset = (pts, sign) => pts.filter(([, y]) => y > coreFrom).map(([x, y]) => [x - sign * edge, y]);
  const cr = inset(right, 1), cl = inset(L, -1);
  const cTip = [(cr[0][0] + cl[0][0]) / 2, coreFrom * 0.6];
  c.part(bladeGeometry(cr, { left: cl, tip: cTip, depth: depth * 0.55, bevel: depth * 0.42, segments: 2, holes }), coreMat);
}

/** Canvas painted in blade space (x across, y along), aligned to the blade UVs. */
function runeMap(L, halfW, paint) {
  const W = 256, H = 2048;
  const [cv, ctx] = makeCanvas(W, H);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  const X = (x) => (x / (2 * halfW) + 0.5) * W;
  const Y = (y) => (1 - y / L) * H;
  paint(ctx, X, Y, W, H);
  const t = canvasTexture(cv, { wrap: false });
  t.repeat.set(1 / (2 * halfW), 1 / L);
  t.offset.set(0.5, 0);
  return t;
}

/** Rough boulder geometry. */
function rock(size, seed, detail = 1) {
  const g = new THREE.DodecahedronGeometry(size, detail);
  const r = rng(seed), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = 0.75 + r() * 0.45;
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * (0.8 + r() * 0.4), p.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
}

/** Hexagonal crystal pointing along `dir` from `base`. */
function crystal(c, material, base, dir, len, r) {
  const d = dir.clone().normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(v3(0, 1, 0), d);
  const body = new THREE.CylinderGeometry(r, r * 0.9, len, 6);
  body.translate(0, len / 2, 0);
  const point = new THREE.ConeGeometry(r, r * 2.6, 6);
  point.translate(0, len + r * 1.3, 0);
  for (const g of [body, point]) {
    const m = new THREE.Matrix4().compose(base, q, v3(1, 1, 1));
    c.part(g, material, null, null, null, m);
  }
}

/** Grip with a wrapped cord (single helix or a diamond cross-wrap), end rings and optional bands. */
function grip(c, { y0, len, r, leather, wrap, diamond = false, turns = 10, bands = [] }) {
  c.part(new THREE.CylinderGeometry(r * 0.94, r, len, 24), leather, [0, y0 + len / 2, 0]);
  const helix = (dir) => {
    const pts = [];
    const n = turns * 14;
    for (let i = 0; i <= n; i++) {
      const a = dir * (i / 14) * TAU, y = y0 + (len * i) / n;
      pts.push(v3(Math.cos(a) * (r + 0.003), y, Math.sin(a) * (r + 0.003)));
    }
    c.part(taperTube(pts, r * 0.16, { tubular: n * 2, radial: 6 }), wrap);
  };
  helix(1);
  if (diamond) helix(-1);
  for (const y of [y0, y0 + len]) c.part(new THREE.TorusGeometry(r + 0.006, r * 0.3, 10, 28), wrap, [0, y, 0], [Math.PI / 2, 0, 0]);
  bands.forEach(([t, mat, scale = 1]) => c.part(new THREE.TorusGeometry((r + 0.008) * scale, r * 0.32, 8, 28), mat, [0, y0 + len * t, 0], [Math.PI / 2, 0, 0]));
}

/* ------------------------------------------------------ the nine designs */

const DESIGNS = {
  /* Tectonic Colossus: a slab of living stone split by veins of magma. */
  earth(c) {
    const L = 1.75, W = 0.16, r = rng(12);
    const right = profile(L, (y) => {
      let x = y < 0.32 ? 0.035 + (W - 0.035) * Math.pow(y / 0.32, 0.8) : W;
      if (y > 0.32) x += (Math.floor(y / 0.085) % 3 === 0 ? -0.014 : 0) + (r() - 0.5) * 0.008;
      if (y > 1.28 && y < 1.62) x -= ((y * 1000) % 55) / 55 * 0.035;       // broken saw teeth near the ricasso
      return x;
    }, 120);
    const left = profile(L, (y) => -(y < 0.12 ? 0.035 + (W - 0.035) * Math.pow(y / 0.12, 0.8) : W + (r() - 0.5) * 0.014 - (Math.floor(y / 0.13) % 4 === 1 ? 0.012 : 0)), 90);
    const veins = runeMap(L, W + 0.05, (ctx, X, Y) => {
      const rand = rng(44);
      ctx.strokeStyle = "#ff9a2a"; ctx.shadowColor = "#ffcf70"; ctx.shadowBlur = 16;
      for (let k = 0; k < 9; k++) {                                         // strata
        const y0 = 0.25 + k * 0.16 + rand() * 0.05;
        ctx.lineWidth = 2 + rand() * 4;
        ctx.beginPath();
        for (let x = -W; x <= W; x += 0.01) { const y = y0 + Math.sin(x * 30 + k) * 0.012; if (x === -W) ctx.moveTo(X(x), Y(y)); else ctx.lineTo(X(x), Y(y)); }
        ctx.stroke();
      }
      for (let k = 0; k < 14; k++) {                                        // fissures
        let x = (rand() - 0.5) * W * 1.6, y = 0.1 + rand() * 1.5;
        ctx.lineWidth = 2 + rand() * 5;
        ctx.beginPath(); ctx.moveTo(X(x), Y(y));
        for (let i = 0; i < 5; i++) { x += (rand() - 0.5) * 0.06; y += 0.02 + rand() * 0.05; ctx.lineTo(X(x), Y(y)); }
        ctx.stroke();
      }
    });
    const core = c.glow(M.matte(0x5d5146, 0.95, { emissive: 0xff8a20, emissiveMap: veins, emissiveIntensity: 1.3, flatShading: true }), 1.3);
    const basalt = M.matte(0x2b2724, 0.7, { metalness: 0.25, flatShading: true });
    forgeBlade(c, { right, left, edge: 0.03, depth: 0.04, coreMat: core, edgeMat: basalt, coreFrom: 0.14 });
    // raised rock strata across both faces
    for (let k = 0; k < 6; k++) c.part(new THREE.BoxGeometry(2 * W - 0.07, 0.022, 0.07), basalt, [0, 0.35 + k * 0.22 + r() * 0.05, 0], [0, 0, (r() - 0.5) * 0.2]);
    const amber = c.gem(0xffa22a, 1.3);
    const cluster = (x, y, z, n, size) => {
      for (let i = 0; i < n; i++) crystal(c, amber, v3(x, y, z), v3((r() - 0.5) * 1.2, (r() - 0.5) * 1.2, Math.sign(z || 1) * (0.6 + r())), size * (0.6 + r() * 0.8), size * 0.18);
    };
    cluster(0.05, 0.55, 0.03, 4, 0.1); cluster(-0.07, 0.98, -0.03, 5, 0.12); cluster(0.03, 1.4, 0.03, 3, 0.09);
    crystal(c, amber, v3(W, 0.82, 0), v3(1, 0.4, 0.2), 0.12, 0.022);
    // guard: basalt blocks bristling with stalactites
    const G = L;
    c.part(rock(1, 3), basalt, [0, G + 0.06, 0], [0, 0, 0], [0.34, 0.1, 0.13]);
    for (const sx of [-1, 1]) c.part(rock(1, sx + 7), basalt, [sx * 0.33, G + 0.07, 0], [r(), r(), r()], [0.1, 0.13, 0.11]);
    [-0.32, -0.2, -0.08, 0.06, 0.18, 0.3].forEach((x, i) => {
      const len = 0.08 + ((i * 37) % 5) * 0.035;
      c.part(new THREE.ConeGeometry(0.03, len, 6), basalt, [x, G - len / 2 + 0.02, (i % 2 - 0.5) * 0.04], [Math.PI, 0, 0]);
    });
    cluster(0, G + 0.12, 0.04, 4, 0.1); cluster(0, G + 0.12, -0.04, 4, 0.1);
    const y0 = G + 0.15, len = 0.55;
    grip(c, { y0, len, r: 0.038, leather: M.matte(0x3a2a1c), wrap: M.metal(0x8a6a30, 0.45), turns: 11, bands: [[0.33, basalt, 1.35], [0.66, basalt, 1.35]] });
    // geode pommel
    c.part(rock(0.1, 21), basalt, [0, y0 + len + 0.07, 0], [0, 0, 0], [1, 0.8, 1]);
    cluster(0, y0 + len + 0.12, 0.01, 6, 0.09);
    c.part(new THREE.SphereGeometry(0.05, 16, 12), amber, [0, y0 + len + 0.09, 0]);
    return { L, W, top: y0 + len + 0.2 };
  },

  /* Zephyr's Edge: a long, curved, single-edged blade pierced for the wind. */
  wind(c) {
    const L = 2.1;
    const cx = (y) => 0.15 * Math.pow(1 - y / L, 2.2);
    const w = (y) => 0.075 * Math.min(1, Math.pow(y / 0.42, 0.55));
    const right = profile(L, (y) => cx(y) + w(y));
    const left = profile(L, (y) => cx(y) - w(y) * 0.8);
    const holes = [0.75, 1.1, 1.45].map((y, i) => HOLE.ellipse(cx(y) + 0.005, y, 0.014 - i * 0.002, 0.1 - i * 0.015));
    const swirl = runeMap(L, 0.26, (ctx, X, Y) => {
      ctx.strokeStyle = "#e8fbff"; ctx.shadowColor = "#ffffff"; ctx.shadowBlur = 10; ctx.lineWidth = 4;
      for (let k = 0; k < 8; k++) {
        const y0 = 0.3 + k * 0.2, s = k % 2 ? 1 : -1;
        ctx.beginPath();
        for (let i = 0; i <= 50; i++) {
          const a = (i / 50) * TAU * 1.5, rr = 0.04 * (1 - i / 60);
          const x = cx(y0) + s * Math.cos(a) * rr, y = y0 + Math.sin(a) * rr * 1.8;
          if (!i) ctx.moveTo(X(x), Y(y)); else ctx.lineTo(X(x), Y(y));
        }
        ctx.stroke();
      }
    });
    const core = c.glow(M.metal(0xdde6ec, 0.14, { emissive: 0xbff4ff, emissiveMap: swirl, emissiveIntensity: 1 }), 1);
    forgeBlade(c, { right, left, tip: [cx(0), 0], edge: 0.018, depth: 0.016, coreMat: core, edgeMat: M.metal(0xf6fafc, 0.06), holes });
    const G = L, silver = M.metal(0xe6edf2, 0.16), gold = M.metal(0xd9ab4f, 0.3);
    c.part(new THREE.CylinderGeometry(0.085, 0.085, 0.022, 36), silver, [0, G + 0.012, 0]);
    c.part(new THREE.TorusGeometry(0.085, 0.008, 8, 36), gold, [0, G + 0.012, 0], [Math.PI / 2, 0, 0]);
    // swept feathered wings, two layers
    const feather = (len) => {
      const s = new THREE.Shape();
      s.moveTo(0, 0); s.quadraticCurveTo(len * 0.3, len * 0.12, len, len * 0.05); s.quadraticCurveTo(len * 0.3, -len * 0.08, 0, 0);
      return new THREE.ExtrudeGeometry(s, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 });
    };
    const plume = M.metal(0xf2f7fb, 0.3, { metalness: 0.7, emissive: 0xaee6ff, emissiveIntensity: 0.12 });
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 9; i++) {
        const len = 0.46 - i * 0.03 - (i % 2) * 0.03;
        const ang = 0.15 + i * 0.13;
        c.part(feather(len), plume, [sx * 0.06, G + 0.02 + i * 0.006, (i % 2 ? 0.01 : -0.01)], [0, sx < 0 ? Math.PI : 0, ang]);
      }
      c.part(taperTube([v3(sx * 0.06, G + 0.02, 0.02), v3(sx * 0.2, G + 0.1, 0.02), v3(sx * 0.3, G + 0.3, 0.02)], (t) => 0.008 * (1 - t) + 0.002, { tubular: 20, radial: 6 }), gold);
    }
    const y0 = G + 0.03, len = 0.62;
    grip(c, { y0, len, r: 0.027, leather: M.matte(0xe6ecf0, 0.7), wrap: silver, diamond: true, turns: 9, bands: [[0.5, gold]] });
    // spiral shell pommel
    const spiral = [];
    for (let i = 0; i <= 80; i++) { const t = i / 80, a = t * TAU * 2.4, rr = 0.075 * (1 - t); spiral.push(v3(Math.cos(a) * rr, y0 + len + 0.03 + t * 0.09, Math.sin(a) * rr)); }
    c.part(taperTube(spiral, (t) => 0.022 * (1 - t) + 0.004, { tubular: 160 }), silver);
    c.part(new THREE.SphereGeometry(0.03, 20, 14), c.gem(0xcff6ff, 1.8), [0, y0 + len + 0.05, 0]);
    // silk ribbons streaming from the pommel
    c.s.ribbons = [0, 1].map((k) => {
      const geo = new THREE.PlaneGeometry(0.04, 0.7, 1, 20);
      geo.translate(0, -0.35, 0);
      const m = c.live(geo, M.matte(0xd8f4ff, 0.6, { side: THREE.DoubleSide, emissive: 0x7ad8ff, emissiveIntensity: 0.25 }), [(k - 0.5) * 0.03, y0 + len + 0.03, 0]);
      m.castShadow = false;
      return { mesh: m, base: geo.attributes.position.array.slice(), phase: k * 1.7 };
    });
    return { L, W: 0.1, top: y0 + len + 0.14 };
  },

  /* Engine Cleaver: a riveted, chainsaw-spined slab with a molten core. */
  machinery(c) {
    const L = 1.8, W = 0.14;
    const right = [[W * 0.7, 0.04], [W, 0.12], ...profile(L, () => W, 12).filter(([, y]) => y > 0.12)];
    const left = profile(L, (y) => {
      if (y < 0.06) return -W * (0.3 + y * 10);
      if (y > 0.25 && y < L - 0.3) return -(W + 0.04 * (1 - ((y - 0.25) / 0.05) % 1));
      return -W;
    }, 260);
    const slot = new THREE.Path([[-0.012, 0.42], [0.012, 0.42], [0.012, L - 0.3], [-0.012, L - 0.3]].map(([x, y]) => new THREE.Vector2(x, y)).reverse());
    const holes = [slot, HOLE.circle(0.075, L - 0.12, 0.018), HOLE.circle(0.075, L - 0.2, 0.018), HOLE.circle(0.075, L - 0.28, 0.018)];
    const circuits = runeMap(L, W + 0.05, (ctx, X, Y) => {
      const rand = rng(5);
      ctx.strokeStyle = "#ffa030"; ctx.fillStyle = "#ffd070"; ctx.shadowColor = "#ffc060"; ctx.shadowBlur = 8; ctx.lineWidth = 3;
      for (let k = 0; k < 22; k++) {
        let x = 0.03 + rand() * 0.08 * (rand() < 0.5 ? -1 : 1), y = 0.2 + rand() * 1.4;
        ctx.beginPath(); ctx.moveTo(X(x), Y(y));
        for (let i = 0; i < 4; i++) { if (i % 2) x += (rand() - 0.5) * 0.07; else y += 0.03 + rand() * 0.08; ctx.lineTo(X(x), Y(y)); }
        ctx.stroke(); ctx.beginPath(); ctx.arc(X(x), Y(y), 6, 0, TAU); ctx.fill();
      }
    });
    const core = c.glow(M.metal(0x5a6068, 0.35, { emissive: 0xffa030, emissiveMap: circuits, emissiveIntensity: 1 }), 1);
    const steel = M.metal(0xc8ccd2, 0.2), brass = M.metal(0xc9933a, 0.3), copper = M.metal(0xb8643a, 0.35);
    forgeBlade(c, { right, left, tip: [0, 0], edge: 0.022, depth: 0.028, coreMat: core, edgeMat: steel, holes, coreFrom: 0.12 });
    const molten = c.gem(0xff7a10, 2.4);
    c.part(new THREE.BoxGeometry(0.018, L - 0.74, 0.012), molten, [0, (0.42 + L - 0.3) / 2, 0]);
    // riveted bands and spine pistons
    for (const y of [0.55, 0.9, 1.25, 1.52]) {
      c.part(new THREE.BoxGeometry(2 * W - 0.05, 0.03, 0.05), M.metal(0x4a4f56, 0.4), [0, y, 0]);
      for (const x of [-W + 0.04, W - 0.04]) for (const z of [-0.026, 0.026]) c.part(new THREE.SphereGeometry(0.008, 10, 8), brass, [x, y, z]);
    }
    for (const [ya, yb] of [[0.62, 0.95], [1.1, 1.45]]) {
      c.part(new THREE.CylinderGeometry(0.014, 0.014, (yb - ya) * 0.55, 12), brass, [-W + 0.05, ya + (yb - ya) * 0.28, 0.03]);
      c.part(new THREE.CylinderGeometry(0.007, 0.007, (yb - ya) * 0.5, 10), steel, [-W + 0.05, ya + (yb - ya) * 0.72, 0.03]);
    }
    // gearbox guard
    const G = L;
    c.part(new THREE.BoxGeometry(0.5, 0.16, 0.12), brass, [0, G + 0.08, 0]);
    c.part(new THREE.BoxGeometry(0.46, 0.12, 0.13), M.metal(0x3a3e44, 0.45), [0, G + 0.08, 0]);
    for (const x of [-0.22, 0.22]) for (const y of [G + 0.02, G + 0.14]) for (const z of [-0.066, 0.066]) c.part(new THREE.CylinderGeometry(0.009, 0.009, 0.006, 6), brass, [x, y, z], [Math.PI / 2, 0, 0]);
    const gear = (ro, n) => { const g = new THREE.ExtrudeGeometry(gearShape(ro, ro * 0.8, n, ro * 0.25), { depth: 0.022, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 1 }); g.translate(0, 0, -0.011); return g; };
    c.spin(c.live(gear(0.13, 16), brass, [-0.26, G + 0.08, 0.075]), 0.7);
    c.spin(c.live(gear(0.09, 12), copper, [0.27, G + 0.1, 0.075]), -1.0);
    c.spin(c.live(gear(0.055, 9), brass, [0.02, G + 0.12, 0.085]), 1.6);
    const exhausts = [];
    for (const sx of [-1, 1]) {
      const end = v3(sx * 0.27, G + 0.44, -0.09);
      c.part(taperTube([v3(sx * 0.17, G + 0.15, -0.03), v3(sx * 0.2, G + 0.28, -0.06), end], 0.024, { tubular: 24, radial: 12 }), copper);
      c.part(new THREE.CylinderGeometry(0.034, 0.028, 0.05, 14, 1, true), steel, [end.x, end.y + 0.02, end.z]);
      exhausts.push(v3(end.x, end.y + 0.05, end.z));
    }
    // pressure gauge
    const gauge = new THREE.Group();
    gauge.position.set(0.14, G + 0.09, 0.068);
    c.s.sword.add(gauge);
    c.live(new THREE.CircleGeometry(0.035, 24), M.matte(0xf2ead8, 0.5), [0, 0, 0.002], [0, 0, 0], 1, gauge);
    c.live(new THREE.TorusGeometry(0.036, 0.006, 8, 24), brass, [0, 0, 0], [0, 0, 0], 1, gauge);
    const needleGeo = new THREE.BoxGeometry(0.003, 0.03, 0.002);
    needleGeo.translate(0, 0.012, 0);
    const needle = c.live(needleGeo, M.matte(0x8a1010), [0, 0, 0.004], [0, 0, 0], 1, gauge);
    c.s.anims.push((t, dt, k) => { needle.rotation.z = 0.6 - k * 0.8 + Math.sin(t * 13) * 0.05 * k; });
    const y0 = G + 0.16, len = 0.5;
    c.part(new THREE.CylinderGeometry(0.03, 0.032, len, 20), M.metal(0x2b2d31, 0.5), [0, y0 + len / 2, 0]);
    for (let i = 0; i < 15; i++) c.part(new THREE.TorusGeometry(0.034, 0.006, 8, 24), i % 4 ? steel : copper, [0, y0 + 0.02 + i * (len - 0.04) / 14, 0], [Math.PI / 2, 0, 0]);
    // flywheel pommel
    const fly = new THREE.Group();
    fly.position.set(0, y0 + len + 0.06, 0);
    c.s.sword.add(fly);
    c.live(new THREE.TorusGeometry(0.085, 0.016, 10, 40), brass, [0, 0, 0], [Math.PI / 2, 0, 0], 1, fly);
    for (let i = 0; i < 6; i++) c.live(new THREE.BoxGeometry(0.16, 0.012, 0.012), steel, [0, 0, 0], [0, (i * Math.PI) / 6, 0], 1, fly);
    c.live(new THREE.SphereGeometry(0.03, 16, 12), molten, [0, 0, 0], [0, 0, 0], 1, fly);
    c.spin(fly, 2.2, "y");
    return { L, W, top: y0 + len + 0.12, spine: v3(-W - 0.03, L * 0.5, 0), exhausts };
  },

  /* Tidecaller: an undulating, barbed blade of living water. */
  water(c) {
    const L = 1.9;
    const cx = (y) => 0.03 * Math.sin(y * 6.5) * Math.min(1, y / 0.3);
    const w = (y) => 0.1 * Math.min(1, Math.pow(y / 0.32, 0.6)) * (1 - 0.14 * y / L);
    const barb = (y, at) => at.reduce((e, yb) => e + (y > yb && y < yb + 0.09 ? 0.05 * (1 - (y - yb) / 0.09) : 0), 0);
    const right = profile(L, (y) => cx(y) + w(y) + barb(y, [0.4, 0.62]), 160);
    const left = profile(L, (y) => cx(y) - w(y) - barb(y, [0.5, 0.72]), 160);
    const holes = [[0.95, 0.022], [1.18, 0.017], [1.36, 0.013]].map(([y, rr]) => HOLE.circle(cx(y), y, rr));
    const waves = runeMap(L, 0.2, (ctx, X, Y) => {
      ctx.strokeStyle = "#8aeaff"; ctx.shadowColor = "#d0f8ff"; ctx.shadowBlur = 10;
      for (let k = -2; k <= 2; k++) {
        ctx.lineWidth = k ? 3 : 6;
        ctx.beginPath();
        for (let y = 0.1; y < L - 0.05; y += 0.01) {
          const x = cx(y) + k * 0.025 + Math.sin(y * 24 + k * 1.3) * 0.012;
          if (y === 0.1) ctx.moveTo(X(x), Y(y)); else ctx.lineTo(X(x), Y(y));
        }
        ctx.stroke();
      }
    });
    const core = c.glow(new THREE.MeshPhysicalMaterial({
      color: 0x6fd0ff, metalness: 0, roughness: 0.05, transmission: 0.7, thickness: 0.08, ior: 1.33,
      attenuationColor: new THREE.Color(0x1a7ad0), attenuationDistance: 0.4, emissive: 0x2a9aff, emissiveMap: waves, emissiveIntensity: 0.8,
    }), 0.8);
    const pearl = new THREE.MeshPhysicalMaterial({ color: 0xeef8ff, metalness: 0.4, roughness: 0.15, iridescence: 1, iridescenceIOR: 1.6, clearcoat: 1 });
    forgeBlade(c, { right, left, edge: 0.02, depth: 0.024, coreMat: core, edgeMat: pearl, holes, coreFrom: 0.12 });
    const G = L, silver = M.metal(0xd8eef6, 0.18), coral = M.matte(0x2ec4b6, 0.5, { emissive: 0x0a6a6a, emissiveIntensity: 0.4 });
    // scallop shell at the heart of the guard
    const shell = new THREE.Shape();
    shell.moveTo(0, 0); shell.absarc(0, 0, 0.13, Math.PI * 0.12, Math.PI * 0.88, false); shell.lineTo(0, 0);
    c.part(new THREE.ExtrudeGeometry(shell, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 2, curveSegments: 24 }), pearl, [0, G, -0.01]);
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * (0.16 + i * 0.085);
      for (const z of [0.022, -0.022]) c.part(taperTube([v3(0, G + 0.01, z), v3(Math.cos(a) * 0.13, G + Math.sin(a) * 0.13, z)], 0.005, { tubular: 6, radial: 5 }), silver);
    }
    for (const sx of [-1, 1]) {
      const curl = [v3(sx * 0.05, G + 0.02, 0)];
      for (let i = 0; i <= 36; i++) { const t = i / 36, a = t * TAU * 1.2, rr = 0.11 * (1 - t * 0.75); curl.push(v3(sx * (0.2 + Math.sin(a) * rr), G + 0.1 - Math.cos(a) * rr, 0)); }
      c.part(taperTube(curl, (t) => 0.03 * (1 - t) + 0.005, { tubular: 90, radial: 10 }), silver);
      // branching coral
      const trunk = [v3(sx * 0.1, G + 0.03, -0.03), v3(sx * 0.16, G - 0.08, -0.05), v3(sx * 0.14, G - 0.2, -0.06)];
      c.part(taperTube(trunk, (t) => 0.018 * (1 - t) + 0.004, { tubular: 16, radial: 8 }), coral);
      c.part(taperTube([trunk[1], v3(sx * 0.24, G - 0.12, -0.05), v3(sx * 0.27, G - 0.2, -0.04)], (t) => 0.012 * (1 - t) + 0.003, { tubular: 12, radial: 6 }), coral);
      c.part(new THREE.SphereGeometry(0.018, 16, 12), pearl, [sx * 0.24, G + 0.12, 0]);
    }
    c.part(new THREE.SphereGeometry(0.045, 24, 16), c.gem(0x1ab0ff, 1.2), [0, G + 0.04, 0], [0, 0, 0], [1, 1.3, 0.8]);
    const y0 = G + 0.12, len = 0.5;
    grip(c, { y0, len, r: 0.032, leather: M.matte(0x0f4a5c), wrap: silver, turns: 10 });
    for (let i = 0; i < 12; i++) c.part(new THREE.TorusGeometry(0.036, 0.007, 6, 20), i % 2 ? pearl : silver, [0, y0 + 0.04 + i * 0.038, 0], [Math.PI / 2, 0, 0], [1, 1, 0.6]);
    // nautilus pommel
    const naut = [];
    for (let i = 0; i <= 90; i++) { const t = i / 90, a = t * TAU * 1.8, rr = 0.1 * Math.exp(-t * 2.2); naut.push(v3(Math.cos(a) * rr, y0 + len + 0.1 + Math.sin(a) * rr, 0)); }
    c.part(taperTube(naut, (t) => 0.045 * (1 - t) + 0.006, { tubular: 180, radial: 12 }), pearl);
    c.part(new THREE.SphereGeometry(0.026, 20, 14), c.gem(0x7ae0ff, 1.6), [0, y0 + len + 0.1, 0]);
    return { L, W: 0.12, top: y0 + len + 0.22 };
  },

  /* Infernal Flamberge: an obsidian flame-blade with red-hot edges and horned guard. */
  fire(c) {
    const L = 2.0, W = 0.1;
    const w = (y) => (y < 0.3 ? W * Math.pow(y / 0.3, 0.7) : W) + (y > 0.22 ? 0.022 * Math.sin(y * 21) : 0);
    const hook = (y, at) => at.reduce((e, yh) => e + (y > yh && y < yh + 0.08 ? 0.075 * Math.pow((y - yh) / 0.08, 2) : 0), 0);
    const right = profile(L, (y) => w(y) + hook(y, [L - 0.5, L - 0.34, L - 0.18]), 200);
    const left = profile(L, (y) => -(w(y) + hook(y, [L - 0.44, L - 0.26])), 200);
    const holes = [HOLE.teardrop(0, 0.8, 0.028, 0.18), HOLE.teardrop(0, 1.18, 0.022, 0.14)];
    const lava = runeMap(L, W + 0.1, (ctx, X, Y) => {
      const rand = rng(7);
      ctx.strokeStyle = "#ff7a20"; ctx.shadowColor = "#ffcc55"; ctx.shadowBlur = 14;
      for (let k = 0; k < 26; k++) {
        let x = (rand() - 0.5) * W * 1.4, y = 0.1 + rand() * 1.8;
        ctx.lineWidth = 2 + rand() * 4;
        ctx.beginPath(); ctx.moveTo(X(x), Y(y));
        for (let i = 0; i < 7; i++) { x = Math.max(-W * 0.8, Math.min(W * 0.8, x + (rand() - 0.5) * 0.04)); y += 0.02 + rand() * 0.04; ctx.lineTo(X(x), Y(y)); }
        ctx.stroke();
      }
    });
    const core = c.glow(M.metal(0x1a0806, 0.35, { metalness: 0.7, emissive: 0xff5a1a, emissiveMap: lava, emissiveIntensity: 1.4 }), 1.4);
    const edgeMat = c.glow(M.metal(0x3a1208, 0.3, { emissive: 0xff4010, emissiveIntensity: 0.6 }), 0.6);
    forgeBlade(c, { right, left, edge: 0.018, depth: 0.024, coreMat: core, edgeMat, holes });
    const G = L, iron = M.metal(0x221c1a, 0.45, { metalness: 0.9 }), gold = M.metal(0xd9ab4f, 0.3);
    for (const sx of [-1, 1]) {
      // great horns sweeping up and back, ridged in gold
      const horn = [v3(sx * 0.06, G + 0.04, 0), v3(sx * 0.22, G + 0.01, 0.01), v3(sx * 0.36, G + 0.1, 0), v3(sx * 0.41, G + 0.27, -0.02), v3(sx * 0.33, G + 0.39, -0.03)];
      c.part(taperTube(horn, (t) => 0.045 * (1 - t) + 0.003, { tubular: 60, radial: 12 }), iron);
      const curve = new THREE.CatmullRomCurve3(horn);
      for (let i = 1; i < 6; i++) {
        const t = i / 7, p = curve.getPointAt(t), tan = curve.getTangentAt(t);
        const m = new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromUnitVectors(v3(0, 0, 1), tan), v3(1, 1, 1));
        c.part(new THREE.TorusGeometry(0.045 * (1 - t) + 0.006, 0.005, 6, 20), gold, null, null, null, m);
      }
      // lesser horns reaching toward the point
      c.part(taperTube([v3(sx * 0.05, G, 0), v3(sx * 0.15, G - 0.05, 0.01), v3(sx * 0.2, G - 0.18, 0), v3(sx * 0.15, G - 0.3, -0.01)], (t) => 0.026 * (1 - t) + 0.003, { tubular: 40, radial: 10 }), iron);
    }
    c.part(new THREE.CapsuleGeometry(0.032, 0.14, 6, 16), iron, [0, G + 0.04, 0], [0, 0, Math.PI / 2]);
    c.part(new THREE.OctahedronGeometry(0.065), c.gem(0xff3a0a, 1.8), [0, G + 0.05, 0], [0, 0, 0], [1, 1.35, 0.8]);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4;
      c.part(taperTube([v3(Math.cos(a) * 0.06, G - 0.03, Math.sin(a) * 0.04), v3(Math.cos(a) * 0.075, G + 0.05, Math.sin(a) * 0.05), v3(Math.cos(a) * 0.03, G + 0.13, Math.sin(a) * 0.02)], 0.007, { tubular: 16, radial: 6 }), gold);
    }
    const y0 = G + 0.1, len = 0.5;
    grip(c, { y0, len, r: 0.032, leather: M.matte(0x140806), wrap: iron, turns: 8 });
    for (let i = 0; i < 20; i++) {                                           // chain wrap
      const a = i * 0.9, y = y0 + 0.03 + i * (len - 0.06) / 19;
      c.part(new THREE.TorusGeometry(0.014, 0.004, 6, 14), gold, [Math.cos(a) * 0.036, y, Math.sin(a) * 0.036], [i % 2 ? Math.PI / 2 : 0, a, 0]);
    }
    // crown of flame tongues around an ember
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU, base = v3(Math.cos(a) * 0.045, y0 + len + 0.02, Math.sin(a) * 0.045);
      c.part(taperTube([base, v3(Math.cos(a + 0.4) * 0.07, y0 + len + 0.09, Math.sin(a + 0.4) * 0.07), v3(Math.cos(a + 0.9) * 0.03, y0 + len + 0.18 + (i % 2) * 0.04, Math.sin(a + 0.9) * 0.03)], (t) => 0.016 * (1 - t) + 0.002, { tubular: 20, radial: 8 }), i % 2 ? gold : iron);
    }
    c.part(new THREE.IcosahedronGeometry(0.04, 0), c.gem(0xffa020, 2.2), [0, y0 + len + 0.07, 0]);
    return { L, W: 0.13, top: y0 + len + 0.2 };
  },

  /* Prismatic Shard: a blade of living crystal, splintering with prisms. */
  glass(c) {
    const L = 1.85, W = 0.12;
    const right = profile(L, (y) => W * Math.min(1, Math.pow(y / 0.35, 0.85)), 14);
    const left = profile(L, (y) => -W * Math.min(1, Math.pow(y / 0.3, 0.85)) * (1 + 0.04 * Math.sin(y * 5)), 14);
    const iris = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.25, roughness: 0.04, iridescence: 1, iridescenceIOR: 1.9, clearcoat: 1, flatShading: true });
    const glassMat = M.crystal();
    forgeBlade(c, { right, left, edge: 0.02, depth: 0.034, coreMat: glassMat, edgeMat: iris });
    // shards suspended inside the blade
    const r = rng(8);
    const hues = [0xff6a8a, 0xffd36b, 0x7dffb0, 0x6bc8ff, 0xc38bff];
    for (let i = 0; i < 9; i++) c.part(new THREE.OctahedronGeometry(0.018 + r() * 0.012), c.gem(hues[i % 5], 1.6), [(r() - 0.5) * 0.1, 0.3 + i * 0.16, 0], [r() * 3, r() * 3, r() * 3], [1, 1.8, 0.5]);
    // crystal spurs erupting from the edges
    [[W, 0.58, 1, 0.5, 0.2], [-W, 0.9, -1, 0.35, 0.24], [W, 1.22, 1, 0.8, 0.15], [-W, 1.48, -1, 1, 0.13], [W * 0.9, 0.3, 1, 0.3, 0.1]].forEach(([x, y, dx, dy, len]) => {
      crystal(c, glassMat, v3(x, y, 0), v3(dx, dy, (r() - 0.5) * 0.4), len, 0.024);
    });
    const G = L;
    for (let i = 0; i < 12; i++) {
      const side = i % 2 ? 1 : -1, k = Math.floor(i / 2);
      crystal(c, i % 3 ? glassMat : iris, v3(side * 0.02 * k, G + 0.02, (r() - 0.5) * 0.04), v3(side * (0.5 + k * 0.35), 0.8 + r() * 0.6 - k * 0.1, (r() - 0.5) * 0.5), 0.1 + r() * 0.18, 0.02 + r() * 0.014);
    }
    c.part(new THREE.OctahedronGeometry(0.05), c.gem(0x7ae8ff, 1.3), [0, G + 0.06, 0], [0, 0, 0], [1, 1.4, 0.8]);
    const y0 = G + 0.08, len = 0.45;
    c.part(new THREE.CylinderGeometry(0.032, 0.032, len, 6), glassMat, [0, y0 + len / 2, 0]);
    c.part(new THREE.CylinderGeometry(0.008, 0.008, len - 0.02, 8), c.gem(0x9af0ff, 2.6), [0, y0 + len / 2, 0]);
    for (const t of [0, 0.5, 1]) c.part(new THREE.TorusGeometry(0.036, 0.007, 6, 6), M.metal(0xd9ab4f, 0.3), [0, y0 + len * t, 0], [Math.PI / 2, 0, 0]);
    const gemY = y0 + len + 0.1;
    c.part(new THREE.IcosahedronGeometry(0.075, 0), iris, [0, gemY, 0], [0.3, 0.2, 0], [1, 1.45, 1]);
    const sat = new THREE.Group();
    sat.position.y = gemY;
    c.s.sword.add(sat);
    for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; c.live(new THREE.OctahedronGeometry(0.02), iris, [Math.cos(a) * 0.14, Math.sin(a * 2) * 0.03, Math.sin(a) * 0.14], [0, 0, 0], [1, 1.8, 1], sat); }
    c.spin(sat, 1.1, "y");
    return { L, W, top: gemY + 0.12, gemY };
  },

  /* Worldroot: a thorned leaf-blade of living wood, bound in roots and moss. */
  wood(c) {
    const L = 1.8, W = 0.13;
    const leaf = (y) => { const t = y / L; return W * Math.sin(Math.min(1, t / 0.58) * Math.PI / 2) * (t > 0.58 ? 1 - (t - 0.58) * 0.75 : 1); };
    const thorns = (y, off) => { if (y < 0.25 || y > L - 0.15) return 0; const f = ((y + off) / 0.075) % 1; return f < 0.35 ? 0.04 * (1 - f / 0.35) : 0; };
    const right = profile(L, (y) => leaf(y) + thorns(y, 0), 240);
    const left = profile(L, (y) => -(leaf(y) + thorns(y, 0.037)), 240);
    const veins = runeMap(L, W + 0.06, (ctx, X, Y) => {
      ctx.strokeStyle = "#8aff5a"; ctx.shadowColor = "#caff9a"; ctx.shadowBlur = 12;
      ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(X(0), Y(0.06)); ctx.lineTo(X(0), Y(L - 0.03)); ctx.stroke();
      ctx.lineWidth = 3;
      for (let y = 0.15; y < L - 0.12; y += 0.085) {
        for (const sx of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(X(0), Y(y));
          ctx.quadraticCurveTo(X(sx * 0.05), Y(y - 0.015), X(sx * leaf(y) * 0.85), Y(y - 0.08));
          ctx.stroke();
        }
      }
    });
    const core = c.glow(M.matte(0x3e2612, 0.75, { emissive: 0x6dff4a, emissiveMap: veins, emissiveIntensity: 1.1 }), 1.1);
    const heart = M.matte(0x9a7048, 0.7);
    forgeBlade(c, { right, left, edge: 0.02, depth: 0.03, coreMat: core, edgeMat: heart });
    const bark = M.matte(0x3a2614, 0.95), moss = M.matte(0x3f6a1e, 1, { flatShading: true }), leafMat = M.matte(0x3f8f2a, 0.6, { emissive: 0x1a5a0a, emissiveIntensity: 0.4, side: THREE.DoubleSide });
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, 0); leafShape.quadraticCurveTo(0.03, 0.035, 0, 0.085); leafShape.quadraticCurveTo(-0.03, 0.035, 0, 0);
    const leafGeo = new THREE.ShapeGeometry(leafShape);
    const r = rng(3);
    // twin roots spiralling down the blade
    for (const ph of [0, Math.PI]) {
      const pts = [];
      for (let i = 0; i <= 40; i++) { const t = i / 40, a = ph + t * TAU * 1.6; pts.push(v3(Math.cos(a) * (leaf(L - t * 1.1) + 0.012), L + 0.02 - t * 1.1, Math.sin(a) * 0.035)); }
      c.part(taperTube(pts, (t) => 0.03 * (1 - t) + 0.005, { tubular: 100, radial: 10 }), bark);
      pts.forEach((p, i) => { if (i % 6 === 3) c.part(leafGeo, leafMat, [p.x, p.y, p.z], [r() * 2, r() * 6, r() * 2]); });
      pts.forEach((p, i) => { if (i % 9 === 1) c.part(new THREE.SphereGeometry(0.03, 10, 8), moss, [p.x, p.y, p.z], [0, 0, 0], [1, 0.5, 1]); });
    }
    // antler-like branching guard
    const G = L;
    const branch = (p0, dir, len, rad, depth) => {
      const bend = v3((r() - 0.5) * 0.3, (r() - 0.2) * 0.3, (r() - 0.5) * 0.3);
      const mid = p0.clone().add(dir.clone().multiplyScalar(len * 0.5)).add(bend.multiplyScalar(len * 0.3));
      const end = p0.clone().add(dir.clone().multiplyScalar(len));
      c.part(taperTube([p0, mid, end], (t) => rad * (1 - t * 0.7), { tubular: 14, radial: 8 }), bark);
      if (depth === 0) {
        if (r() < 0.5) c.part(new THREE.IcosahedronGeometry(0.018, 0), c.gem(0xff8ad8, 1.3), [end.x, end.y, end.z]);
        else for (let k = 0; k < 3; k++) c.part(leafGeo, leafMat, [end.x, end.y, end.z], [r() * 3, r() * 6, r() * 3], 1.3);
        return;
      }
      for (let k = 0; k < 2; k++) {
        const nd = dir.clone().applyAxisAngle(v3(0, 0, 1), (k ? 1 : -1) * (0.45 + r() * 0.3)).add(v3(0, 0, (r() - 0.5) * 0.4)).normalize();
        branch(mid.clone().lerp(end, 0.4 + k * 0.4), nd, len * 0.62, rad * 0.62, depth - 1);
      }
    };
    for (const sx of [-1, 1]) branch(v3(sx * 0.04, G + 0.04, 0), v3(sx, 0.55, 0).normalize(), 0.34, 0.03, 3);
    c.part(new THREE.SphereGeometry(0.06, 16, 12), bark, [0, G + 0.05, 0], [0, 0, 0], [1.4, 0.8, 0.8]);
    const y0 = G + 0.1, len = 0.55;
    grip(c, { y0, len, r: 0.034, leather: bark, wrap: M.matte(0x3f7a26, 0.7), turns: 7 });
    [0.2, 0.45, 0.75].forEach((t, i) => c.part(leafGeo, leafMat, [0.03, y0 + len * t, 0.02], [0.3, i * 2, -0.9], 1.1));
    // glowing seed in a cage of roots
    const seedY = y0 + len + 0.09;
    c.part(new THREE.SphereGeometry(0.045, 24, 16), c.gem(0x3ad45a, 1.4), [0, seedY, 0], [0, 0, 0], [1, 1.35, 1]);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      c.part(taperTube([v3(Math.cos(a) * 0.03, y0 + len, Math.sin(a) * 0.03), v3(Math.cos(a + 0.5) * 0.07, seedY, Math.sin(a + 0.5) * 0.07), v3(Math.cos(a + 1.2) * 0.02, seedY + 0.09, Math.sin(a + 1.2) * 0.02)], (t) => 0.012 * (1 - t) + 0.003, { tubular: 16, radial: 6 }), bark);
    }
    return { L, W, top: seedY + 0.12 };
  },

  /* Voidreaver: a hooked blade of starless dark, its edges burning violet. */
  space(c) {
    const L = 2.0, W = 0.12;
    const right = profile(L, (y) => {
      if (y < 0.14) return 0.17 * (y / 0.14);                              // hook point
      if (y < 0.3) return 0.17 - (y - 0.14) / 0.16 * 0.1;                  // notch
      if (y < 0.48) return 0.07 + (y - 0.3) / 0.18 * (W - 0.07);
      return W + (y > L - 0.3 && y < L - 0.12 ? 0.02 : 0);
    }, 160);
    const left = profile(L, (y) => -W * Math.min(1, Math.pow(y / 0.4, 0.7)), 60);
    const holes = [HOLE.star(0, 0.82, 0.05, 0.022), HOLE.star(0, 1.2, 0.038, 0.017), HOLE.crescent(0, L - 0.28, 0.05)];
    const cosmos = runeMap(L, W + 0.1, (ctx, X, Y, CW, CH) => {
      const rand = rng(99);
      for (let i = 0; i < 10; i++) {
        const x = rand() * CW, y = rand() * CH;
        const g = ctx.createRadialGradient(x, y, 2, x, y, 120 + rand() * 220);
        const hue = ["rgba(170,90,255,", "rgba(80,120,255,", "rgba(255,90,200,"][i % 3];
        g.addColorStop(0, hue + ".75)"); g.addColorStop(1, hue + "0)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH);
      }
      for (let i = 0; i < 1400; i++) { ctx.fillStyle = `rgba(255,255,255,${rand()})`; const sz = rand() < 0.04 ? 4 : 1.6; ctx.fillRect(rand() * CW, rand() * CH, sz, sz); }
    });
    cosmos.wrapT = THREE.RepeatWrapping;
    c.s.scrollMap = cosmos;
    const core = c.glow(M.metal(0x07040f, 0.15, { metalness: 0.9, emissive: 0xffffff, emissiveMap: cosmos, emissiveIntensity: 1.1 }), 1.1);
    const edgeMat = c.glow(M.metal(0x2a1650, 0.2, { emissive: 0x8a4aff, emissiveIntensity: 0.8 }), 0.8);
    forgeBlade(c, { right, left, edge: 0.018, depth: 0.024, coreMat: core, edgeMat, holes, coreFrom: 0.2 });
    const G = L, moonMat = M.metal(0xcab8ff, 0.22), silver = M.metal(0xe6e0ff, 0.18);
    const crescent = new THREE.Shape();
    crescent.absarc(0, 0, 0.3, Math.PI * 1.06, Math.PI * 1.94, false);
    crescent.absarc(0, -0.08, 0.25, Math.PI * 1.9, Math.PI * 1.1, true);
    const cg = new THREE.ExtrudeGeometry(crescent, { depth: 0.018, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.007, bevelSegments: 2, curveSegments: 48 });
    cg.translate(0, 0, -0.009);
    c.part(cg, moonMat, [0, G + 0.31, 0]);
    for (const sx of [-1, 1]) c.part(new THREE.OctahedronGeometry(0.024), c.gem(0xffffff, 2.4), [sx * 0.285, G + 0.22, 0], [0, 0, 0.785]);
    c.part(new THREE.SphereGeometry(0.045, 24, 16), c.gem(0x9b6bff, 1.6), [0, G + 0.05, 0]);
    // armillary rings turning around the guard
    for (const [rad, axis, speed] of [[0.14, "x", 0.9], [0.17, "z", -0.6]]) {
      const ring = new THREE.Group();
      ring.position.set(0, G + 0.05, 0);
      c.s.sword.add(ring);
      c.live(new THREE.TorusGeometry(rad, 0.006, 8, 64), silver, [0, 0, 0], [axis === "x" ? Math.PI / 2 : 0, 0, 0], 1, ring);
      c.spin(ring, speed, axis === "x" ? "z" : "x");
    }
    const y0 = G + 0.1, len = 0.52;
    grip(c, { y0, len, r: 0.03, leather: M.matte(0x1a1238), wrap: moonMat, turns: 9 });
    for (let i = 0; i < 8; i++) { const a = i * 1.7; c.part(new THREE.OctahedronGeometry(0.009), c.gem(0xe0d0ff, 1.5), [Math.cos(a) * 0.034, y0 + 0.05 + i * 0.06, Math.sin(a) * 0.034]); }
    const pY = y0 + len + 0.08;
    c.part(new THREE.SphereGeometry(0.07, 32, 20), M.matte(0x6a3ad8, 0.4, { emissive: 0x4a1aa8, emissiveIntensity: 0.9 }), [0, pY, 0]);
    c.part(new THREE.RingGeometry(0.09, 0.13, 64), M.matte(0xd9ccff, 0.4, { emissive: 0x8a6aff, emissiveIntensity: 0.5, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }), [0, pY, 0], [Math.PI / 2 - 0.4, 0.2, 0]);
    const orbit = new THREE.Group();
    orbit.position.y = pY;
    c.s.sword.add(orbit);
    c.live(new THREE.SphereGeometry(0.018, 16, 12), c.gem(0xbfe0ff, 1.4), [0.19, 0.02, 0], [0, 0, 0], 1, orbit);
    c.live(new THREE.SphereGeometry(0.012, 12, 8), c.gem(0xffb0e0, 1.4), [-0.15, -0.03, 0.08], [0, 0, 0], 1, orbit);
    c.spin(orbit, 0.9, "y");
    return { L, W, top: pY + 0.12 };
  },

  /* Chronoblade: a bronze blade with escapement teeth and clockwork set into it. */
  time(c) {
    const L = 1.9, W = 0.13;
    const right = profile(L, (y) => {
      const base = W * Math.min(1, Math.pow(y / 0.32, 0.65));
      if (y > 0.3 && y < L - 0.3) return base + 0.034 * (((y - 0.3) / 0.065) % 1);
      return base;
    }, 280);
    const left = profile(L, (y) => -W * Math.min(1, Math.pow(y / 0.36, 0.65)));
    const gearHoles = [[0.62, 0.068, 12], [1.02, 0.056, 11], [1.38, 0.045, 10]];
    const holes = gearHoles.map(([y, ro, n]) => HOLE.fromShape(gearShape(ro, ro * 0.84, n), 0, y));
    const numerals = runeMap(L, W + 0.06, (ctx, X, Y) => {
      ctx.fillStyle = "#fff0b8"; ctx.strokeStyle = "#fff0b8"; ctx.shadowColor = "#ffe08a"; ctx.shadowBlur = 10;
      ctx.font = "700 64px Cinzel, serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ["XII", "III", "VI", "IX"].forEach((n, i) => { ctx.save(); ctx.translate(X(0), Y([0.3, 0.82, 1.2, 1.55][i] - 0.04)); ctx.rotate(-Math.PI / 2); ctx.fillText(n, 0, 0); ctx.restore(); });
      ctx.lineWidth = 3;
      for (let y = 0.18; y < L - 0.2; y += 0.02) { ctx.beginPath(); ctx.moveTo(X(-W * 0.8), Y(y)); ctx.lineTo(X(-W * (Math.round(y * 50) % 5 ? 0.66 : 0.5)), Y(y)); ctx.stroke(); }
    });
    const core = c.glow(M.metal(0xb8923e, 0.28, { emissive: 0xfff1b0, emissiveMap: numerals, emissiveIntensity: 1 }), 1);
    const gold = M.metal(0xe0b85a, 0.2), brass = M.metal(0xc9933a, 0.3);
    forgeBlade(c, { right, left, edge: 0.02, depth: 0.026, coreMat: core, edgeMat: gold, holes });
    gearHoles.forEach(([y, ro, n], i) => {
      const g = new THREE.ExtrudeGeometry(gearShape(ro * 0.8, ro * 0.66, n - 2, ro * 0.18), { depth: 0.012, bevelEnabled: false });
      g.translate(0, 0, -0.006);
      c.spin(c.live(g, brass, [0, y, 0]), i % 2 ? -1.2 : 0.9);
    });
    // clock guard with a gear turning behind the dial
    const G = L;
    const cogs = new THREE.ExtrudeGeometry(gearShape(0.21, 0.18, 30, 0.02), { depth: 0.012, bevelEnabled: false });
    cogs.translate(0, 0, -0.006);
    c.spin(c.live(cogs, brass, [0, G + 0.1, 0]), 0.25);
    c.part(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 64), gold, [0, G + 0.1, 0], [Math.PI / 2, 0, 0]);
    c.part(new THREE.TorusGeometry(0.17, 0.012, 12, 64), gold, [0, G + 0.1, 0]);
    const dial = M.matte(0xffffff, 0.4, { map: clockDial(), emissive: 0xffe8b0, emissiveIntensity: 0.2 });
    for (const z of [0.021, -0.021]) c.part(new THREE.CircleGeometry(0.155, 64), dial, [0, G + 0.1, z], [0, z < 0 ? Math.PI : 0, 0]);
    c.s.hands = [];
    for (const z of [0.024, -0.024]) {
      const hour = new THREE.Group(), minute = new THREE.Group();
      hour.position.set(0, G + 0.1, z); minute.position.set(0, G + 0.1, z);
      c.live(new THREE.BoxGeometry(0.01, 0.08, 0.003), M.metal(0x2a2624, 0.5), [0, 0.036, 0], [0, 0, 0], 1, hour);
      c.live(new THREE.BoxGeometry(0.006, 0.125, 0.003), M.matte(0x8a1a2a), [0, 0.056, 0], [0, 0, 0], 1, minute);
      c.s.sword.add(hour, minute);
      c.s.hands.push(hour, minute);
    }
    c.part(new THREE.SphereGeometry(0.012, 12, 8), c.gem(0xffe08a, 2), [0, G + 0.1, 0.026]);
    for (const sx of [-1, 1]) {
      c.part(new THREE.BoxGeometry(0.2, 0.03, 0.03), gold, [sx * 0.26, G + 0.1, 0]);
      const curl = [];
      for (let i = 0; i <= 30; i++) { const t = i / 30, a = t * TAU * 1.1, rr = 0.05 * (1 - t * 0.7); curl.push(v3(sx * (0.36 + Math.sin(a) * rr), G + 0.15 - Math.cos(a) * rr, 0)); }
      c.part(taperTube(curl, (t) => 0.016 * (1 - t) + 0.004, { tubular: 60 }), gold);
      c.part(new THREE.SphereGeometry(0.02, 12, 10), c.gem(0xffe08a, 1.6), [sx * 0.36, G + 0.15, 0]);
    }
    // pendulum swinging across the blade's face
    const pend = new THREE.Group();
    pend.position.set(0, G + 0.02, 0.03);
    c.s.sword.add(pend);
    c.live(new THREE.BoxGeometry(0.008, 0.5, 0.006), gold, [0, -0.25, 0], [0, 0, 0], 1, pend);
    c.live(new THREE.CylinderGeometry(0.055, 0.055, 0.012, 32), gold, [0, -0.52, 0], [Math.PI / 2, 0, 0], 1, pend);
    c.live(new THREE.SphereGeometry(0.018, 12, 10), c.gem(0xffe08a, 1.6), [0, -0.52, 0.008], [0, 0, 0], 1, pend);
    c.s.anims.push((t) => { pend.rotation.z = Math.sin(t * 2.2) * 0.32; });
    const y0 = G + 0.28, len = 0.5;
    grip(c, { y0, len, r: 0.03, leather: M.matte(0x2b1f3a), wrap: gold, turns: 10, bands: [[0.5, brass]] });
    // hourglass pommel
    const hg = new THREE.Group();
    hg.position.y = y0 + len + 0.1;
    c.s.sword.add(hg);
    const frame = (geo, p) => c.live(geo, gold, p, [0, 0, 0], 1, hg);
    frame(new THREE.CylinderGeometry(0.06, 0.06, 0.014, 32), [0, -0.085, 0]);
    frame(new THREE.CylinderGeometry(0.06, 0.06, 0.014, 32), [0, 0.085, 0]);
    for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; frame(new THREE.CylinderGeometry(0.005, 0.005, 0.17, 8), [Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05]); }
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, transmission: 1, thickness: 0.02, ior: 1.4 });
    c.live(new THREE.ConeGeometry(0.042, 0.078, 24, 1, true), glassMat, [0, 0.039, 0], [Math.PI, 0, 0], 1, hg);
    c.live(new THREE.ConeGeometry(0.042, 0.078, 24, 1, true), glassMat, [0, -0.039, 0], [0, 0, 0], 1, hg);
    const sand = c.gem(0xf5d67a, 0.6);
    c.s.sandTop = c.live(new THREE.ConeGeometry(0.034, 0.055, 24), sand, [0, 0.03, 0], [Math.PI, 0, 0], 1, hg);
    c.s.sandBottom = c.live(new THREE.ConeGeometry(0.036, 0.055, 24), sand, [0, -0.05, 0], [0, 0, 0], 1, hg);
    return { L, W, top: y0 + len + 0.2 };
  },
};

/* ------------------------------------------------------------- effects */

const AURA_STYLE = { fire: 0, water: 1, wind: 1, wood: 0, earth: 3, space: 2, machinery: 3, glass: 2, time: 0 };

function numeralRingTexture(color) {
  const [cv, ctx] = makeCanvas(1024, 64);
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, 1024, 64);
  ctx.fillStyle = color; ctx.font = "700 40px Cinzel, serif"; ctx.textBaseline = "middle";
  ctx.fillText("XII · I · II · III · IV · V · VI · VII · VIII · IX · X · XI · ", 8, 34);
  return canvasTexture(cv);
}

/** Particle system scaled to the sword's length. */
function addParticles(s, mode, glow, count, { size = 1.1, scale, parent = s.sword, pos = [0, 0, 0] } = {}) {
  const pm = particleMaterial(mode, glow, { size });
  s.fxMats.push(pm);
  const pts = particles(count, pm, s.index * 13 + mode * 7 + 3);
  pts.position.set(...pos);
  pts.scale.setScalar(scale ?? s.spec.L / 1.3);
  parent.add(pts);
  return pts;
}

function addRibbonHelix(s, color, { radius, turns, y0, y1, thickness, speed, phase = 0 }) {
  const pts = [];
  for (let i = 0; i <= 120; i++) { const t = i / 120, a = phase + t * TAU * turns; pts.push(v3(Math.cos(a) * radius * (0.8 + t * 0.4), y0 + (y1 - y0) * t, Math.sin(a) * radius * (0.8 + t * 0.4))); }
  const mat = ribbonMaterial(color, { speed, bands: turns * 1.5 });
  s.fxMats.push(mat);
  const mesh = new THREE.Mesh(taperTube(pts, thickness, { tubular: 240, radial: 6 }), mat);
  s.sword.add(mesh);
  return mesh;
}

function buildEffects(s) {
  const { element, glow, spec } = s;
  const L = spec.L;
  // streaming aura: two crossed planes hugging the blade
  const aura = auraMaterial(glow, { speed: element === "wind" ? 2.2 : 1, style: AURA_STYLE[element] });
  s.fxMats.push(aura);
  for (const ry of [0, Math.PI / 2]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(spec.W * 5, L + 0.1), aura);
    p.position.y = L / 2 + 0.02;
    p.rotation.y = ry;
    p.renderOrder = 2;
    s.sword.add(p);
  }

  switch (element) {
    case "earth": {
      addParticles(s, PARTICLE_MODES.earth, glow, 70, { size: 1.3, parent: s.root, scale: 1.6 });
      const boulders = new THREE.InstancedMesh(rock(0.05, 5, 0), new THREE.MeshStandardMaterial({ color: 0x6a5c4e, roughness: 0.95, flatShading: true, emissive: 0xff8a20, emissiveIntensity: 0.18 }), 12);
      boulders.castShadow = true;
      s.root.add(boulders);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      s.anims.push((t, dt, k) => {
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU + t * (0.15 + k * 0.15), rr = 0.45 + (i % 3) * 0.12;
          e.set(t * (0.3 + i * 0.07), t * 0.2 + i, 0); q.setFromEuler(e);
          const sc = 0.6 + ((i * 7) % 5) * 0.25;
          m.compose(v3(Math.cos(a) * rr, 0.12 + (i % 4) * 0.14 + Math.sin(t * 0.8 + i) * 0.04 + k * 0.25, Math.sin(a) * rr), q, v3(sc, sc * 0.8, sc));
          boulders.setMatrixAt(i, m);
        }
        boulders.instanceMatrix.needsUpdate = true;
      });
      break;
    }
    case "wind": {
      addParticles(s, PARTICLE_MODES.wind, glow, 140, { size: 1.0 });
      const helices = [[0.26, 3, 0.1, L * 1.05, 0.006, 1.6, 0], [0.34, 2.2, 0.2, L * 0.9, 0.004, 2.2, 2.1], [0.2, 4, 0.05, L * 0.7, 0.005, 1.2, 4.2]]
        .map(([radius, turns, y0, y1, thickness, speed, phase]) => addRibbonHelix(s, glow, { radius, turns, y0, y1, thickness, speed, phase }));
      s.anims.push((t) => helices.forEach((h, i) => (h.rotation.y = t * (1.2 + i * 0.5) * (i % 2 ? -1 : 1))));
      s.anims.push((t, dt, k) => s.ribbons.forEach(({ mesh, base, phase }) => {
        const pos = mesh.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const y = base[i * 3 + 1], hang = -y / 0.7;
          pos.setX(i, base[i * 3] + Math.sin(t * 3 + phase + y * 8) * 0.05 * hang * (0.6 + k));
          pos.setZ(i, Math.sin(t * 2.3 + phase + y * 5) * 0.08 * hang * (0.6 + k));
        }
        pos.needsUpdate = true;
        mesh.geometry.computeVertexNormals();
      }));
      break;
    }
    case "machinery": {
      addParticles(s, PARTICLE_MODES.machinery, glow, 90, { size: 1.0, pos: [spec.spine.x, spec.spine.y, 0], scale: 1.2 });
      spec.exhausts.forEach((p) => addParticles(s, PARTICLE_MODES.steam, 0xdddde8, 40, { size: 1.6, pos: [p.x, p.y, p.z], scale: 1 }));
      const holo = new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const rings = [[0.42, 0.37, 30, 0.5], [0.3, 0.26, 20, 0.95]].map(([ro, ri, n, h]) => {
        const m = new THREE.Mesh(new THREE.ShapeGeometry(gearShape(ro, ri, n, ri - 0.03)), holo);
        m.rotation.x = -Math.PI / 2;
        m.position.y = L * h;
        s.sword.add(m);
        return m;
      });
      s.anims.push((t, dt, k) => { rings[0].rotation.z = t * 0.5; rings[1].rotation.z = -t * 0.8; holo.opacity = 0.1 + k * 0.28; });
      break;
    }
    case "water": {
      addParticles(s, PARTICLE_MODES.water, glow, 110, { size: 1.1 });
      const streams = [[0.22, 2.5, 0.05, L * 0.95, 0.012, 0.9, 0], [0.3, 1.8, 0.2, L * 0.75, 0.008, 1.3, 3]]
        .map(([radius, turns, y0, y1, thickness, speed, phase]) => addRibbonHelix(s, 0x3cb8ff, { radius, turns, y0, y1, thickness, speed, phase }));
      s.anims.push((t) => streams.forEach((h, i) => (h.rotation.y = -t * (0.6 + i * 0.3))));
      break;
    }
    case "fire": {
      addParticles(s, PARTICLE_MODES.fire, glow, 160, { size: 1.3 });
      const flames = [];
      for (let i = 0; i < 10; i++) {
        const side = i % 2 ? 1 : -1, y = 0.3 + (i >> 1) * 0.3;
        const fm = flameMaterial({ seed: i * 1.9 + s.index, intensity: 0.8 });
        flames.push(fm);
        for (const ry of [0, Math.PI / 2]) {
          const q = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.34), fm);
          q.position.set(side * (spec.W + 0.02), y, 0);
          q.rotation.set(0, ry, -side * 0.2);
          q.renderOrder = 3;
          s.sword.add(q);
        }
      }
      s.anims.push((t, dt, k) => flames.forEach((f) => { f.uniforms.uTime.value = t; f.uniforms.uIntensity.value = 0.25 + k * 1.1; }));
      break;
    }
    case "glass": {
      addParticles(s, PARTICLE_MODES.glass, glow, 80, { size: 1.2 });
      const shards = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.045), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, metalness: 0.3, iridescence: 1, iridescenceIOR: 2, clearcoat: 1, emissive: 0x8ae8ff, emissiveIntensity: 0.3, flatShading: true }), 10);
      s.sword.add(shards);
      const rayMat = prismRayMaterial();
      s.fxMats.push(rayMat);
      const rays = new THREE.Group();
      rays.position.y = spec.gemY;
      s.sword.add(rays);
      for (let i = 0; i < 6; i++) {
        const g = new THREE.PlaneGeometry(0.22, 1.1);
        g.translate(0, 0.55, 0);
        const m = new THREE.Mesh(g, rayMat);
        m.rotation.set(0, (i / 6) * TAU, 1.1);
        m.renderOrder = 3;
        rays.add(m);
      }
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      s.anims.push((t, dt, k) => {
        rays.rotation.y = t * 0.4;
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TAU - t * (0.25 + k * 0.3), rr = 0.32 + (i % 3) * 0.08;
          e.set(t + i, t * 0.7 + i * 2, 0); q.setFromEuler(e);
          m.compose(v3(Math.cos(a) * rr, 0.4 + (i / 10) * L * 0.8 + Math.sin(t * 0.8 + i) * 0.08, Math.sin(a) * rr), q, v3(1, 1.8, 1));
          shards.setMatrixAt(i, m);
        }
        shards.instanceMatrix.needsUpdate = true;
      });
      break;
    }
    case "wood": {
      addParticles(s, PARTICLE_MODES.wood, glow, 50, { size: 0.9 });
      addParticles(s, PARTICLE_MODES.fireflies, 0xd8ff6a, 40, { size: 1.0 });
      const bloom = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.022, 0), M.gem(0xff8ad8, 1.2), 16);
      s.root.add(bloom);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion();
      s.anims.push((t, dt, k) => {
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * TAU + (i % 2) * 0.2, rr = 0.25 + (i % 3) * 0.09;
          const sc = (0.4 + 0.6 * k) * (0.8 + 0.2 * Math.sin(t * 2 + i));
          m.compose(v3(Math.cos(a) * rr, 0.012, Math.sin(a) * rr), q, v3(sc, sc * 0.5, sc));
          bloom.setMatrixAt(i, m);
        }
        bloom.instanceMatrix.needsUpdate = true;
      });
      break;
    }
    case "space": {
      addParticles(s, PARTICLE_MODES.space, glow, 130, { size: 1.1 });
      const neb = nebulaMaterial(glow);
      s.fxMats.push(neb);
      s.nebula = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), neb);
      s.nebula.position.y = L * 0.75;
      s.nebula.renderOrder = 1;
      s.sword.add(s.nebula);
      break;
    }
    case "time": {
      addParticles(s, PARTICLE_MODES.time, glow, 80, { size: 1.0 });
      const tex = numeralRingTexture("#ffe8a0");
      tex.repeat.set(2, 1);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, opacity: 0.6 });
      const rings = [[0.4, 0.3], [0.8, 0.24], [1.2, 0.2]].map(([h, rad]) => {
        const r = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, 0.06, 64, 1, true), mat);
        r.position.y = h * L / 1.3;
        s.sword.add(r);
        return r;
      });
      s.anims.push((t, dt, k) => { rings.forEach((r, i) => (r.rotation.y = t * (0.3 + i * 0.2) * (i % 2 ? -1 : 1))); mat.opacity = 0.15 + k * 0.5; });
      break;
    }
  }
}

/* --------------------------------------------------------------- public */

/**
 * Builds a sword planted in the table. `outward` is the horizontal direction
 * away from the table centre; the hilt leans that way by roughly 45°.
 */
export function createSword(element, glow, index, outward) {
  const r = rng(index * 31 + 7);
  const s = {
    element, glow, index,
    root: new THREE.Group(), tilt: new THREE.Group(), slot: new THREE.Group(), sword: new THREE.Group(),
    glowMats: [], fxMats: [], anims: [], spinners: [],
    intensity: 0.35, target: 0.35, lift: 0, liftTarget: 0,
  };
  s.root.add(s.tilt);
  s.tilt.add(s.slot);
  s.slot.add(s.sword);
  s.sword.position.y = -EMBED;

  // forging context handed to each design
  const B = new MergeBuilder();
  const c = {
    s,
    part(geo, material, pos, rot, scale, matrix) {
      B.add(geo, material, matrix || xf(pos || [0, 0, 0], rot || [0, 0, 0], scale ?? 1));
    },
    live(geo, material, pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, parent = s.sword) {
      const m = new THREE.Mesh(geo, material);
      m.position.set(...pos); m.rotation.set(...rot);
      if (Array.isArray(scale)) m.scale.set(...scale); else m.scale.setScalar(scale);
      m.castShadow = m.receiveShadow = true;
      parent.add(m);
      return m;
    },
    spin(obj, speed, axis = "z") { s.spinners.push([obj, speed, axis]); return obj; },
    gem(color, e = 1) { const m = M.gem(color, e); s.glowMats.push([m, e]); return m; },
    glow(material, base) { s.glowMats.push([material, base]); return material; },
  };
  s.spec = DESIGNS[element](c);
  s.sword.add(B.build());
  buildEffects(s);

  // lean the hilt outward ~45° (with variation) and twist the blade a little
  const yaw = (r() - 0.5) * 0.45;
  const dir = outward.clone().applyAxisAngle(v3(0, 1, 0), yaw).normalize();
  const axis = v3(dir.z, 0, -dir.x).normalize();
  s.tilt.quaternion.setFromAxisAngle(axis, THREE.MathUtils.degToRad(40 + r() * 12));
  // set the blade on its side: edges face up and down, flats face sideways (give or take a little)
  s.sword.rotation.y = Math.atan2(-axis.z, axis.x) + Math.PI / 2 + (r() - 0.5) * 0.3;

  // sigil and shockwave lie flat on the table
  s.sigilMat = sigilMaterial(SIGIL_STYLE[element], glow);
  const sigil = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), s.sigilMat);
  sigil.rotation.x = -Math.PI / 2;
  sigil.position.y = 0.004;
  s.root.add(sigil);
  s.shockMat = shockwaveMaterial(glow);
  s.shock = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), s.shockMat);
  s.shock.rotation.x = -Math.PI / 2;
  s.shock.position.y = 0.006;
  s.shock.visible = false;
  s.root.add(s.shock);
  const scorch = new THREE.Mesh(new THREE.CircleGeometry(0.14, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, depthWrite: false }));
  scorch.rotation.x = -Math.PI / 2;
  scorch.position.y = 0.002;
  s.root.add(scorch);

  // hit volume along the sword's axis (stays put while the sword rises)
  const total = s.spec.top;
  s.hit = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.26, total + 0.6, 10), new THREE.MeshBasicMaterial({ visible: false }));
  s.hit.position.y = total / 2 + 0.1;
  s.hit.userData.sword = s;
  s.tilt.add(s.hit);

  // point the camera looks at when this sword is chosen
  s.focus = new THREE.Object3D();
  s.focus.position.y = s.spec.L * 0.75;
  s.slot.add(s.focus);
  return s;
}

const _camPos = new THREE.Vector3();

/** Per-frame animation. Returns true while the sword is still moving (so shadows can refresh). */
export function updateSword(s, t, dt, camera) {
  s.intensity += (s.target - s.intensity) * Math.min(1, dt * 4);
  const prevLift = s.lift;
  s.lift += (s.liftTarget - s.lift) * Math.min(1, dt * 3.2);
  const k = s.intensity;

  // hovering draws the sword out of the wood and floats it upward
  const e = s.lift * s.lift * (3 - 2 * s.lift);
  s.slot.position.y = e * (EMBED + 0.32);
  s.tilt.position.y = e * 0.3 + Math.sin(t * 1.6 + s.index) * 0.015 * e;

  s.fxMats.forEach((m) => { m.uniforms.uTime.value = t; m.uniforms.uIntensity.value = k; });
  s.sigilMat.uniforms.uTime.value = t;
  s.sigilMat.uniforms.uIntensity.value = 0.3 + k * 0.85;
  s.glowMats.forEach(([m, base], i) => { m.emissiveIntensity = Math.min(base, 1.6) * (0.55 + Math.min(k, 1.3) * 0.4) * (0.92 + 0.08 * Math.sin(t * 3 + i)); });
  s.spinners.forEach(([obj, speed, axis]) => (obj.rotation[axis] += dt * speed * (0.5 + k)));
  s.anims.forEach((fn) => fn(t, dt, k));

  if (s.scrollMap) s.scrollMap.offset.y = t * 0.012;
  if (s.hands) s.hands.forEach((h, i) => (h.rotation.z = -(i % 2 ? t * 1.6 : t * 0.14) * (i < 2 ? 1 : -1)));
  if (s.sandTop) {
    const p = (t * 0.12) % 1;
    s.sandTop.scale.setScalar(1 - p * 0.8);
    s.sandBottom.scale.setScalar(0.2 + p * 0.8);
  }
  if (s.nebula) s.nebula.lookAt(camera.getWorldPosition(_camPos));
  if (s.shockStart != null) {
    const p = Math.min(1, (t - s.shockStart) / 1.1);
    s.shock.visible = p < 1;
    s.shockMat.uniforms.uProgress.value = p;
  }
  return Math.abs(s.lift - prevLift) > 1e-4;
}
