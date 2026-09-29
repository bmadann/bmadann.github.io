/*
 * Small geometry and texture helpers shared by the 3D hall.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Deterministic pseudo-random generator so the hall looks the same on every visit. */
export function rng(seed = 1) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export const TAU = Math.PI * 2;
export const lerp = (a, b, t) => a + (b - a) * t;
export const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

/**
 * A tube swept along a smooth curve through `points` whose radius varies
 * along its length: radius(t) with t in [0, 1]. Used for horns, vines,
 * mane locks, plumes and scrollwork.
 */
export function taperTube(points, radius, { tubular = 48, radial = 10, closed = false } = {}) {
  const curve = new THREE.CatmullRomCurve3(points, closed, "catmullrom", 0.5);
  const frames = curve.computeFrenetFrames(tubular, closed);
  const pos = [], nor = [], uv = [], idx = [];
  const P = new THREE.Vector3(), N = new THREE.Vector3();
  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    curve.getPointAt(t, P);
    const r = typeof radius === "function" ? radius(t) : radius;
    const n = frames.normals[i], b = frames.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * TAU;
      const s = Math.sin(a), c = -Math.cos(a);
      N.set(c * n.x + s * b.x, c * n.y + s * b.y, c * n.z + s * b.z).normalize();
      pos.push(P.x + r * N.x, P.y + r * N.y, P.z + r * N.z);
      nor.push(N.x, N.y, N.z);
      uv.push(t, j / radial);
    }
  }
  for (let i = 0; i < tubular; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j, b = a + radial + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** A tapered cylinder running from point a to point b. */
export function limb(a, b, r0, r1 = r0, radial = 16) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, radial, 1);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  g.applyQuaternion(q);
  g.translate(a.x, a.y, a.z);
  return g;
}

/** Gear outline as a THREE.Shape (optionally with an axle hole). */
export function gearShape(rOut, rIn, teeth, hole = 0) {
  const s = new THREE.Shape();
  const step = TAU / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step, q = step / 4;
    const pts = [[a - q * 1.15, rIn], [a - q * 0.55, rOut], [a + q * 0.55, rOut], [a + q * 1.15, rIn]];
    pts.forEach(([ang, r], k) => {
      const x = Math.cos(ang) * r, y = Math.sin(ang) * r;
      if (i === 0 && k === 0) s.moveTo(x, y); else s.lineTo(x, y);
    });
  }
  s.closePath();
  if (hole) {
    const h = new THREE.Path();
    h.absarc(0, 0, hole, 0, TAU, true);
    s.holes.push(h);
  }
  return s;
}

/**
 * Collects geometries by material and merges each group into one mesh,
 * so detailed props (armour, the lion's mane, the chandelier) cost only a
 * handful of draw calls.
 */
export class MergeBuilder {
  constructor() { this.groups = new Map(); }
  add(geometry, material, matrix) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (matrix) g.applyMatrix4(matrix);
    if (!this.groups.has(material)) this.groups.set(material, []);
    this.groups.get(material).push(g);
    return this;
  }
  build({ castShadow = true, receiveShadow = true } = {}) {
    const group = new THREE.Group();
    for (const [mat, geos] of this.groups) {
      const mesh = new THREE.Mesh(mergeGeometries(geos, false), mat);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      group.add(mesh);
    }
    return group;
  }
}

/** Matrix from position, Euler rotation and scale. */
export function mat(pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(...pos),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
    new THREE.Vector3(...(Array.isArray(scale) ? scale : [scale, scale, scale])),
  );
}

/* ------------------------------------------------------------ textures */

export function makeCanvas(w, h = w) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")];
}

export function canvasTexture(c, { repeat = [1, 1], color = true, wrap = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Sprinkles fine speckle noise over a canvas region. */
export function speckle(ctx, w, h, count, alpha, rand, colors = ["#000", "#fff"]) {
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = rand() * alpha;
    ctx.fillStyle = colors[(rand() * colors.length) | 0];
    const s = 1 + rand() * 2.5;
    ctx.fillRect(rand() * w, rand() * h, s, s);
  }
  ctx.globalAlpha = 1;
}

/** Wavy wood grain lines running horizontally across a region. */
export function woodGrain(ctx, x, y, w, h, rand, { dark = "rgba(40,18,6,", light = "rgba(255,210,150,", density = 1 } = {}) {
  const lines = Math.round(h * 0.55 * density);
  for (let i = 0; i < lines; i++) {
    const yy = y + rand() * h;
    const amp = 1 + rand() * 5, freq = 0.004 + rand() * 0.012, ph = rand() * TAU;
    ctx.strokeStyle = (rand() < 0.75 ? dark : light) + (0.05 + rand() * 0.18) + ")";
    ctx.lineWidth = 0.5 + rand() * 2.2;
    ctx.beginPath();
    for (let xx = x; xx <= x + w; xx += 8) {
      const py = yy + Math.sin(xx * freq + ph) * amp + Math.sin(xx * freq * 3.1 + ph * 2) * amp * 0.3;
      if (xx === x) ctx.moveTo(xx, py); else ctx.lineTo(xx, py);
    }
    ctx.stroke();
  }
  // knots
  for (let k = 0; k < Math.max(1, (w * h) / 180000); k++) {
    const kx = x + rand() * w, ky = y + rand() * h, r = 4 + rand() * 10;
    const g = ctx.createRadialGradient(kx, ky, 0, kx, ky, r * 2.4);
    g.addColorStop(0, "rgba(30,12,4,.55)");
    g.addColorStop(1, "rgba(30,12,4,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(kx, ky, r * 2.4, r, 0, 0, TAU);
    ctx.fill();
  }
}
