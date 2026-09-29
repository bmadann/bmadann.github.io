/*
 * The Round Table: marquetry top with gold inlay, carved apron, turned
 * pedestal on clawed feet, and the owner's name set in gold at its heart.
 */
import * as THREE from "three";
import { TTFLoader } from "three/addons/loaders/TTFLoader.js";
import { Font } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
import { rng, makeCanvas, canvasTexture, woodGrain, speckle, taperTube, v3, TAU } from "./util.js";

export const TABLE_R = 2.3;
export const TABLE_TOP = 0.95;
export const SWORD_RING = 1.3;

const FONT_URL = "https://cdn.jsdelivr.net/npm/@fontsource/pirata-one/files/pirata-one-latin-400-normal.woff";

/** Paints the tabletop. Returns { map, metal, bump }. */
function paintTop(swords, elements) {
  const S = 2048, C = S / 2, R = C - 4;
  const [c, ctx] = makeCanvas(S);
  const [m, mx] = makeCanvas(S);
  const [b, bx] = makeCanvas(S);
  const rand = rng(77);
  const toPx = (meters) => (meters / TABLE_R) * R;
  mx.fillStyle = "#000"; mx.fillRect(0, 0, S, S);
  bx.fillStyle = "#888"; bx.fillRect(0, 0, S, S);

  // Winchester-style segments in alternating woods
  const n = swords.length;
  for (let i = 0; i < n; i++) {
    const a0 = (i - 0.5) / n * TAU - Math.PI / 2, a1 = (i + 0.5) / n * TAU - Math.PI / 2;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(C, C); ctx.arc(C, C, R, a0, a1); ctx.closePath(); ctx.clip();
    ctx.fillStyle = i % 2 ? "#5a2e16" : "#7a4a24";
    ctx.fillRect(0, 0, S, S);
    // grain runs radially: rotate so the grain follows the segment
    ctx.translate(C, C);
    ctx.rotate((a0 + a1) / 2);
    woodGrain(ctx, 0, -R * 0.4, R, R * 0.8, rand, { density: 1.6 });
    ctx.restore();
  }
  // sheen and age
  const shade = ctx.createRadialGradient(C, C, 0, C, C, R);
  shade.addColorStop(0, "rgba(255,220,170,.10)"); shade.addColorStop(0.7, "rgba(0,0,0,0)"); shade.addColorStop(1, "rgba(0,0,0,.35)");
  ctx.fillStyle = shade; ctx.beginPath(); ctx.arc(C, C, R, 0, TAU); ctx.fill();
  speckle(ctx, S, S, 40000, 0.1, rand);

  const gold = (fn, width = 6) => {
    for (const [g, color, lw] of [[ctx, "#c9a13b", width], [mx, "#fff", width], [bx, "#fff", width]]) {
      g.strokeStyle = color; g.fillStyle = color; g.lineWidth = lw; fn(g);
    }
  };
  const groove = (fn, width = 5) => {
    for (const [g, color] of [[ctx, "rgba(20,8,2,.8)"], [bx, "#222"]]) { g.strokeStyle = color; g.lineWidth = width; fn(g); }
  };

  // segment dividers
  for (let i = 0; i < n; i++) {
    const a = (i + 0.5) / n * TAU - Math.PI / 2;
    gold((g) => { g.beginPath(); g.moveTo(C + Math.cos(a) * toPx(0.95), C + Math.sin(a) * toPx(0.95)); g.lineTo(C + Math.cos(a) * toPx(2.05), C + Math.sin(a) * toPx(2.05)); g.stroke(); }, 5);
  }
  // concentric inlay rings
  for (const [r, w] of [[2.24, 8], [2.2, 3], [2.05, 4], [0.95, 6], [0.9, 3]]) gold((g) => { g.beginPath(); g.arc(C, C, toPx(r), 0, TAU); g.stroke(); }, w);
  // ornamental band between 2.05 and 2.2: lozenges and dots
  for (let i = 0; i < 90; i++) {
    const a = (i / 90) * TAU, r = toPx(2.125);
    const x = C + Math.cos(a) * r, y = C + Math.sin(a) * r;
    gold((g) => {
      g.save(); g.translate(x, y); g.rotate(a);
      if (i % 2) { g.beginPath(); g.moveTo(-9, 0); g.lineTo(0, -12); g.lineTo(9, 0); g.lineTo(0, 12); g.closePath(); g.fill(); }
      else { g.beginPath(); g.arc(0, 0, 4, 0, TAU); g.fill(); }
      g.restore();
    });
  }
  // seat names beneath each sword, curved along the rim and upright from outside the table
  const SPACING = 3;
  ctx.font = mx.font = bx.font = "700 34px Cinzel, serif";
  swords.forEach((s, i) => {
    const a = (i / n) * TAU;
    const r = toPx(1.96);
    const flip = a > Math.PI / 2 && a < Math.PI * 1.5;
    const label = `${elements[s.element].label} · ${s.title}`.toUpperCase();
    const widths = [...label].map((ch) => ctx.measureText(ch).width + SPACING);
    const total = widths.reduce((p, w) => p + w, 0);
    let run = 0;
    [...label].forEach((ch, k) => {
      const off = (run + widths[k] / 2 - total / 2) / r;
      run += widths[k];
      const phi = flip ? a - off : a + off;
      for (const g of [ctx, mx, bx]) {
        g.save();
        g.translate(C + Math.sin(phi) * r, C - Math.cos(phi) * r);
        g.rotate(phi + (flip ? Math.PI : 0));
        g.textAlign = "center"; g.textBaseline = "middle";
        g.fillStyle = g === ctx ? "#e8c46a" : "#fff";
        g.fillText(ch, 0, 0);
        g.restore();
      }
    });
  });
  // branded centre medallion: scorched well framed by carved rope
  const burn = ctx.createRadialGradient(C, C, toPx(0.2), C, C, toPx(0.9));
  burn.addColorStop(0, "rgba(12,5,2,.85)"); burn.addColorStop(0.75, "rgba(20,8,2,.7)"); burn.addColorStop(1, "rgba(30,12,4,0)");
  ctx.fillStyle = burn; ctx.beginPath(); ctx.arc(C, C, toPx(0.9), 0, TAU); ctx.fill();
  bx.fillStyle = "#555"; bx.beginPath(); bx.arc(C, C, toPx(0.88), 0, TAU); bx.fill();
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * TAU, r = toPx(0.925);
    groove((g) => { g.beginPath(); g.moveTo(C + Math.cos(a) * (r - 10), C + Math.sin(a) * (r - 10)); g.lineTo(C + Math.cos(a + 0.05) * (r + 10), C + Math.sin(a + 0.05) * (r + 10)); g.stroke(); }, 3);
  }
  // compass rose beneath the name
  gold((g) => {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU, len = toPx(i % 4 === 0 ? 0.84 : i % 2 ? 0.55 : 0.7), w = toPx(i % 4 === 0 ? 0.05 : 0.03);
      g.globalAlpha = 0.35;
      g.beginPath(); g.moveTo(C + Math.cos(a) * len, C + Math.sin(a) * len);
      g.lineTo(C + Math.cos(a + Math.PI / 2) * w, C + Math.sin(a + Math.PI / 2) * w);
      g.lineTo(C + Math.cos(a - Math.PI / 2) * w, C + Math.sin(a - Math.PI / 2) * w);
      g.closePath(); g.fill();
      g.globalAlpha = 1;
    }
  });

  return {
    map: canvasTexture(c, { wrap: false }),
    metal: canvasTexture(m, { wrap: false, color: false }),
    bump: canvasTexture(b, { wrap: false, color: false }),
  };
}

/** Carved apron: gothic arches in relief. */
function apronTexture() {
  const [c, ctx] = makeCanvas(2048, 128);
  const [b, bx] = makeCanvas(2048, 128);
  const rand = rng(4);
  ctx.fillStyle = "#4a2812"; ctx.fillRect(0, 0, 2048, 128);
  woodGrain(ctx, 0, 0, 2048, 128, rand, { density: 1.2 });
  bx.fillStyle = "#777"; bx.fillRect(0, 0, 2048, 128);
  for (let i = 0; i < 36; i++) {
    const x = i * (2048 / 36) + 28;
    for (const [g, fill] of [[ctx, "rgba(15,6,2,.55)"], [bx, "#222"]]) {
      g.fillStyle = fill;
      g.beginPath();
      g.moveTo(x - 18, 110); g.lineTo(x - 18, 50); g.quadraticCurveTo(x - 18, 18, x, 12); g.quadraticCurveTo(x + 18, 18, x + 18, 50); g.lineTo(x + 18, 110);
      g.closePath(); g.fill();
    }
    ctx.fillStyle = "#c9a13b"; ctx.beginPath(); ctx.arc(x + 28, 64, 5, 0, TAU); ctx.fill();
  }
  return { map: canvasTexture(c), bump: canvasTexture(b, { color: false }) };
}

export async function createTable(swords, elements, ownerName) {
  const table = new THREE.Group();
  const top = paintTop(swords, elements);
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6a3c1c, roughness: 0.55, metalness: 0.05 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd9ab4f, metalness: 1, roughness: 0.28 });

  // tabletop
  const topMat = new THREE.MeshStandardMaterial({
    map: top.map, metalnessMap: top.metal, metalness: 1, roughness: 0.42,
    bumpMap: top.bump, bumpScale: 1.2,
  });
  // metalnessMap multiplies `metalness`; wood areas are black → 0
  const surface = new THREE.Mesh(new THREE.CircleGeometry(TABLE_R, 180), topMat);
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = TABLE_TOP;
  surface.receiveShadow = true;
  table.add(surface);

  const add = (geo, mat, pos, rot = [0, 0, 0]) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos); m.rotation.set(...rot);
    m.castShadow = m.receiveShadow = true;
    table.add(m);
    return m;
  };

  // edge: thick top, bullnose moulding and a beaded gold band
  add(new THREE.CylinderGeometry(TABLE_R, TABLE_R, 0.1, 180, 1, true), woodMat, [0, TABLE_TOP - 0.05, 0]);
  add(new THREE.TorusGeometry(TABLE_R, 0.05, 16, 200), woodMat, [0, TABLE_TOP - 0.03, 0], [Math.PI / 2, 0, 0]);
  add(new THREE.TorusGeometry(TABLE_R + 0.005, 0.014, 10, 200), goldMat, [0, TABLE_TOP - 0.1, 0], [Math.PI / 2, 0, 0]);
  const bead = new THREE.InstancedMesh(new THREE.SphereGeometry(0.018, 10, 8), goldMat, 150);
  const mm = new THREE.Matrix4();
  for (let i = 0; i < 150; i++) {
    const a = (i / 150) * TAU;
    mm.setPosition(Math.cos(a) * (TABLE_R + 0.03), TABLE_TOP - 0.03, Math.sin(a) * (TABLE_R + 0.03));
    bead.setMatrixAt(i, mm);
  }
  bead.castShadow = true;
  table.add(bead);

  // carved apron beneath the top
  const ap = apronTexture();
  ap.map.repeat.set(2, 1); ap.bump.repeat.set(2, 1);
  add(new THREE.CylinderGeometry(TABLE_R - 0.12, TABLE_R - 0.18, 0.22, 180, 1, true), new THREE.MeshStandardMaterial({ map: ap.map, bumpMap: ap.bump, bumpScale: 2, roughness: 0.6, side: THREE.DoubleSide }), [0, TABLE_TOP - 0.21, 0]);
  add(new THREE.TorusGeometry(TABLE_R - 0.18, 0.02, 10, 160), goldMat, [0, TABLE_TOP - 0.32, 0], [Math.PI / 2, 0, 0]);
  add(new THREE.CylinderGeometry(TABLE_R - 0.12, TABLE_R - 0.12, 0.02, 120), woodMat, [0, TABLE_TOP - 0.11, 0]);

  // turned pedestal
  const prof = [[0.62, 0], [0.62, 0.05], [0.5, 0.08], [0.46, 0.14], [0.36, 0.18], [0.3, 0.26], [0.34, 0.3], [0.26, 0.34], [0.22, 0.46],
    [0.26, 0.5], [0.33, 0.53], [0.26, 0.57], [0.2, 0.62], [0.24, 0.66], [0.4, 0.7], [0.55, 0.72], [0.55, 0.74], [0, 0.74]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  add(new THREE.LatheGeometry(prof, 64), woodMat, [0, 0.05, 0]);
  for (const y of [0.35, 0.58, 0.79]) add(new THREE.TorusGeometry(y === 0.79 ? 0.4 : 0.25, 0.016, 10, 64), goldMat, [0, y, 0], [Math.PI / 2, 0, 0]);

  // four clawed legs
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4;
    const dir = (r, y) => v3(Math.cos(a) * r, y, Math.sin(a) * r);
    add(taperTube([dir(0.35, 0.3), dir(0.7, 0.34), dir(1.05, 0.24), dir(1.25, 0.1)], (t) => 0.1 - t * 0.04, { tubular: 40, radial: 14 }), woodMat, [0, 0, 0]);
    add(taperTube([dir(0.5, 0.36), dir(0.8, 0.39), dir(1.08, 0.3)], 0.012, { tubular: 30, radial: 8 }), goldMat, [0, 0, 0]);
    const foot = dir(1.28, 0.08);
    add(new THREE.SphereGeometry(0.085, 20, 14), goldMat, [foot.x, foot.y, foot.z]);
    for (let k = -1; k <= 1; k++) {
      const ca = a + k * 0.5;
      const claw = taperTube([v3(foot.x, 0.12, foot.z), v3(foot.x + Math.cos(ca) * 0.08, 0.1, foot.z + Math.sin(ca) * 0.08), v3(foot.x + Math.cos(ca) * 0.11, 0.02, foot.z + Math.sin(ca) * 0.11)], (t) => 0.025 * (1 - t) + 0.004, { tubular: 16, radial: 8 });
      add(claw, woodMat, [0, 0, 0]);
    }
  }

  // name in gold
  const name = await goldName(ownerName, goldMat).catch(() => null);
  if (name) table.add(name);
  return table;
}

/** Extruded gold lettering, flat on the table, readable from the front and from above. */
async function goldName(ownerName, goldMat) {
  const buffer = await (await fetch(FONT_URL)).arrayBuffer();
  const font = new Font(new TTFLoader().parse(buffer));
  const lines = ownerName.split(" ");
  const group = new THREE.Group();
  const nameMat = new THREE.MeshStandardMaterial({ color: 0xf0c060, metalness: 1, roughness: 0.3, emissive: 0x8a5210, emissiveIntensity: 0.3 });
  const lineHeight = 0.42;
  lines.forEach((line, i) => {
    const g = new TextGeometry(line, { font, size: 0.34, depth: 0.025, curveSegments: 10, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 3 });
    g.computeBoundingBox();
    const bb = g.boundingBox;
    g.translate(-(bb.max.x + bb.min.x) / 2, 0, 0);
    const mesh = new THREE.Mesh(g, nameMat);
    mesh.castShadow = true;
    mesh.position.y = ((lines.length - 1) / 2 - i) * lineHeight - 0.12;
    group.add(mesh);
  });
  // lie flat: text "up" points toward the back of the hall (-z)
  group.rotation.x = -Math.PI / 2;
  group.position.y = TABLE_TOP + 0.002;
  // a gold fillet frames the brand
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.012, 8, 160), goldMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = TABLE_TOP + 0.004;
  const wrap = new THREE.Group();
  wrap.add(group, ring);
  return wrap;
}
