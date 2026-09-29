/*
 * The great hall: stone walls, a roaring fireplace crowned by a gilded lion,
 * a moonlit window, royal banners, suits of armour and a candle chandelier.
 *
 * The hall is 20 m square and 10 m tall, centred on the table.
 * The fireplace is on the back wall (z = -10); the camera starts at +z.
 */
import * as THREE from "three";
import { rng, taperTube, limb, MergeBuilder, mat, v3, TAU, makeCanvas, canvasTexture } from "./util.js";
import { stoneWall, flagstones, darkWood, emberLog, rug, bannerCloth, windowCookie } from "./textures.js";
import { flameMaterial, moonbeamMaterial, nightSkyMaterial, particleMaterial, particles, PARTICLE_MODES } from "./shaders.js";

export const HALF = 10;
export const HEIGHT = 10;

export function createRoom() {
  const room = new THREE.Group();
  const animated = [];          // callbacks run every frame: (t, dt) => void
  const flames = [];            // flame materials (time uniform)
  const lights = {};

  const add = (parent, geo, material, pos = [0, 0, 0], rot = [0, 0, 0], { cast = true, receive = true } = {}) => {
    const m = new THREE.Mesh(geo, material);
    m.position.set(...pos);
    m.rotation.set(...rot);
    m.castShadow = cast;
    m.receiveShadow = receive;
    parent.add(m);
    return m;
  };

  /* ----------------------------------------------------------- materials */
  const wallTex = stoneWall(3);
  const stoneMat = (rx, ry, tint = 0xffffff) => {
    const map = wallTex.map.clone(), bump = wallTex.bump.clone();
    map.repeat.set(rx, ry); bump.repeat.set(rx, ry);
    map.needsUpdate = bump.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 3, roughness: 0.92, color: tint });
  };
  const carvedStone = new THREE.MeshStandardMaterial({ color: 0x8a8274, roughness: 0.85, bumpMap: wallTex.bump, bumpScale: 0.6 });
  const darkStone = new THREE.MeshStandardMaterial({ color: 0x3a3632, roughness: 0.9, bumpMap: wallTex.bump, bumpScale: 1 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd9ab4f, metalness: 1, roughness: 0.3 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x1e1c1b, metalness: 0.85, roughness: 0.5 });
  const oak = new THREE.MeshStandardMaterial({ map: darkWood(5), roughness: 0.75 });
  const velvet = new THREE.MeshStandardMaterial({ color: 0x5a0a16, roughness: 0.95 });

  /* ------------------------------------------------------- floor & walls */
  const floorTex = flagstones(9);
  for (const t of [floorTex.map, floorTex.bump]) t.repeat.set(5, 5);
  add(room, new THREE.PlaneGeometry(HALF * 2, HALF * 2), new THREE.MeshStandardMaterial({ map: floorTex.map, bumpMap: floorTex.bump, bumpScale: 2.5, roughness: 0.82 }), [0, 0, 0], [-Math.PI / 2, 0, 0], { cast: false });

  const wallMat = stoneMat(6.6, 3.3);
  const walls = [
    [[0, HEIGHT / 2, -HALF], [0, 0, 0]],
    [[0, HEIGHT / 2, HALF], [0, Math.PI, 0]],
    [[-HALF, HEIGHT / 2, 0], [0, Math.PI / 2, 0]],
    [[HALF, HEIGHT / 2, 0], [0, -Math.PI / 2, 0]],
  ];
  walls.forEach(([p, r]) => add(room, new THREE.PlaneGeometry(HALF * 2, HEIGHT), wallMat, p, r, { cast: false }));

  // skirting plinth and gilded cornice around the hall
  for (const [p, r] of walls) {
    const g = new THREE.Group();
    g.position.set(p[0], 0, p[2]);
    g.rotation.set(...r);
    add(g, new THREE.BoxGeometry(HALF * 2, 0.35, 0.3), darkStone, [0, 0.175, 0.15]);
    add(g, new THREE.BoxGeometry(HALF * 2, 0.5, 0.45), carvedStone, [0, HEIGHT - 1.25, 0.22]);
    add(g, new THREE.BoxGeometry(HALF * 2, 0.06, 0.5), gold, [0, HEIGHT - 1.52, 0.25]);
    add(g, new THREE.BoxGeometry(HALF * 2, 0.9, 0.2), darkStone, [0, HEIGHT - 0.45, 0.1]);
    room.add(g);
  }

  // pilasters with gold capitals along the side walls and front wall
  const pilaster = (x, z, ry) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    add(g, new THREE.BoxGeometry(0.7, HEIGHT - 1.5, 0.3), stoneMat(0.35, 2.6), [0, (HEIGHT - 1.5) / 2, 0.15]);
    add(g, new THREE.BoxGeometry(0.9, 0.5, 0.45), carvedStone, [0, 0.25, 0.22]);
    add(g, new THREE.BoxGeometry(0.95, 0.35, 0.5), carvedStone, [0, HEIGHT - 1.68, 0.25]);
    add(g, new THREE.BoxGeometry(0.98, 0.05, 0.52), gold, [0, HEIGHT - 1.86, 0.26]);
    room.add(g);
  };
  for (const z of [-7.2, 0.6, 6.4]) { pilaster(-HALF, z, Math.PI / 2); pilaster(HALF, z, -Math.PI / 2); }
  for (const x of [-3.6, 3.6]) pilaster(x, HALF, Math.PI);

  /* ------------------------------------------------------------- ceiling */
  add(room, new THREE.PlaneGeometry(HALF * 2, HALF * 2), new THREE.MeshStandardMaterial({ map: darkWood(8, { base: "#1e120a" }), roughness: 0.9 }), [0, HEIGHT, 0], [Math.PI / 2, 0, 0], { cast: false });
  for (const z of [-7.5, -2.5, 2.5, 7.5]) add(room, new THREE.BoxGeometry(HALF * 2, 0.6, 0.45), oak, [0, HEIGHT - 0.3, z]);
  for (const x of [-5, 5]) add(room, new THREE.BoxGeometry(0.35, 0.4, HALF * 2), oak, [x, HEIGHT - 0.65, 0]);

  /* ------------------------------------------------------------------ rug */
  const rugMesh = add(room, new THREE.PlaneGeometry(7.2, 7.2), new THREE.MeshStandardMaterial({ map: rug(13), roughness: 1 }), [0, 0.012, 0], [-Math.PI / 2, 0, 0], { cast: false });
  rugMesh.receiveShadow = true;

  /* ------------------------------------------------------------ fireplace */
  const fp = new THREE.Group();
  fp.position.set(0, 0, -HALF);
  room.add(fp);
  const breast = stoneMat(1.8, 3.3, 0x8f877d);
  // chimney breast built around the opening
  add(fp, new THREE.BoxGeometry(1.6, HEIGHT, 1.0), breast, [-2.4, HEIGHT / 2, 0.5]);
  add(fp, new THREE.BoxGeometry(1.6, HEIGHT, 1.0), breast, [2.4, HEIGHT / 2, 0.5]);
  add(fp, new THREE.BoxGeometry(3.2, HEIGHT - 2.7, 1.0), breast, [0, 2.7 + (HEIGHT - 2.7) / 2, 0.5]);
  // sooty firebox
  const soot = new THREE.MeshStandardMaterial({ color: 0x120c08, roughness: 1, bumpMap: wallTex.bump, bumpScale: 2 });
  add(fp, new THREE.PlaneGeometry(3.2, 2.7), soot, [0, 1.35, 0.02]);
  add(fp, new THREE.PlaneGeometry(1.0, 2.7), soot, [-1.6, 1.35, 0.5], [0, Math.PI / 2, 0]);
  add(fp, new THREE.PlaneGeometry(1.0, 2.7), soot, [1.6, 1.35, 0.5], [0, -Math.PI / 2, 0]);
  add(fp, new THREE.PlaneGeometry(3.2, 1.0), soot, [0, 2.7, 0.5], [Math.PI / 2, 0, 0]);
  // carved surround with a Tudor arch
  const surround = new THREE.Shape();
  surround.moveTo(-2.6, 0); surround.lineTo(2.6, 0); surround.lineTo(2.6, 3.5); surround.lineTo(-2.6, 3.5); surround.closePath();
  const arch = new THREE.Path();
  arch.moveTo(-1.6, 0); arch.lineTo(-1.6, 2.1); arch.quadraticCurveTo(-1.55, 2.62, 0, 2.72); arch.quadraticCurveTo(1.55, 2.62, 1.6, 2.1); arch.lineTo(1.6, 0); arch.closePath();
  surround.holes.push(arch);
  add(fp, new THREE.ExtrudeGeometry(surround, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 3, curveSegments: 24 }), carvedStone, [0, 0, 1.0]);
  // gold keystone and arch trim
  add(fp, taperTube([v3(-1.62, 0.1, 1.42), v3(-1.62, 2.1, 1.42), v3(-1.2, 2.58, 1.42), v3(0, 2.76, 1.42), v3(1.2, 2.58, 1.42), v3(1.62, 2.1, 1.42), v3(1.62, 0.1, 1.42)], 0.035, { tubular: 120 }), gold);
  const key = new THREE.Shape();
  key.moveTo(-0.13, 0); key.lineTo(0.13, 0); key.lineTo(0.2, 0.46); key.lineTo(-0.2, 0.46); key.closePath();
  add(fp, new THREE.ExtrudeGeometry(key, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 }), carvedStone, [0, 2.7, 1.36]);
  add(fp, new THREE.OctahedronGeometry(0.07), gold, [0, 2.93, 1.53]);
  // columns
  const colProfile = [[0.3, 0], [0.3, 0.12], [0.24, 0.2], [0.2, 0.3], [0.18, 2.9], [0.24, 3.0], [0.3, 3.1], [0.34, 3.25], [0.34, 3.4], [0, 3.4]].map(([r, y]) => new THREE.Vector2(r, y));
  for (const x of [-2.95, 2.95]) {
    add(fp, new THREE.LatheGeometry(colProfile, 32), carvedStone, [x, 0.15, 1.45]);
    for (const y of [0.45, 3.2]) add(fp, new THREE.TorusGeometry(0.22, 0.025, 8, 32), gold, [x, y, 1.45], [Math.PI / 2, 0, 0]);
  }
  // mantel shelf
  add(fp, new THREE.BoxGeometry(6.8, 0.28, 1.25), carvedStone, [0, 3.7, 1.15]);
  add(fp, new THREE.BoxGeometry(6.9, 0.08, 1.3), gold, [0, 3.86, 1.15]);
  add(fp, new THREE.BoxGeometry(6.4, 0.2, 1.05), carvedStone, [0, 3.48, 1.1]);
  // hearth
  add(fp, new THREE.BoxGeometry(6.2, 0.16, 2.2), darkStone, [0, 0.08, 1.3]);
  add(fp, new THREE.BoxGeometry(6.25, 0.03, 2.25), gold, [0, 0.165, 1.3]);
  // overmantel panel for the lion
  add(fp, new THREE.BoxGeometry(4.2, 3.9, 0.14), velvet, [0, 6.35, 1.07]);
  for (const [w, h, x, y] of [[4.4, 0.12, 0, 8.3], [4.4, 0.12, 0, 4.4], [0.12, 4.0, -2.15, 6.35], [0.12, 4.0, 2.15, 6.35]]) add(fp, new THREE.BoxGeometry(w, h, 0.2), gold, [x, y, 1.12]);

  // logs, andirons, fire
  const logTex = emberLog(21);
  const logMat = new THREE.MeshStandardMaterial({ map: logTex.map, emissive: 0xff5a10, emissiveMap: logTex.emissive, emissiveIntensity: 1.6, roughness: 0.95 });
  for (const [x, z, ry, rz] of [[-0.35, 0.65, 0.3, 0.05], [0.4, 0.7, -0.35, -0.05], [0, 0.95, 0.05, 0]]) {
    add(fp, new THREE.CylinderGeometry(0.13, 0.15, 1.6, 14), logMat, [x, 0.33 + (z > 0.9 ? 0.2 : 0), z], [0, ry, Math.PI / 2 + rz]);
  }
  for (const x of [-0.9, 0.9]) {
    add(fp, new THREE.BoxGeometry(0.06, 0.06, 1.0), iron, [x, 0.3, 0.8]);
    add(fp, new THREE.CylinderGeometry(0.03, 0.05, 0.6, 10), iron, [x, 0.55, 1.28]);
    add(fp, new THREE.SphereGeometry(0.07, 12, 10), gold, [x, 0.88, 1.28]);
  }
  const fire = new THREE.Group();
  fire.position.set(0, 0.25, 0.8);
  fp.add(fire);
  for (let i = 0; i < 7; i++) {
    const fm = flameMaterial({ seed: i * 1.37, intensity: 1.25 });
    flames.push(fm);
    const w = 1.1 + (i % 3) * 0.25, h = 1.6 + (i % 2) * 0.5;
    const q = add(fire, new THREE.PlaneGeometry(w, h), fm, [(i - 3) * 0.2, h / 2, (i % 3) * 0.08], [0, (i - 3) * 0.35, 0], { cast: false, receive: false });
    q.renderOrder = 3;
  }
  const embers = particles(140, particleMaterial(PARTICLE_MODES.embers, 0xff8a30, { size: 1.4 }), 3);
  embers.material.uniforms.uIntensity.value = 1;
  embers.position.set(0, 0.3, 0.8);
  fp.add(embers);
  flames.push(embers.material);
  // glowing bed of coals
  const coals = new THREE.Mesh(new THREE.CircleGeometry(0.9, 32), new THREE.MeshBasicMaterial({ color: 0xff5a10, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
  coals.rotation.x = -Math.PI / 2;
  coals.scale.set(1.5, 0.6, 1);
  coals.position.set(0, 0.2, 0.8);
  fp.add(coals);

  const fireLight = new THREE.PointLight(0xff8a3a, 40, 0, 1.6);
  fireLight.position.set(0, 1.2, -HALF + 1.9);
  fireLight.castShadow = true;
  fireLight.shadow.mapSize.set(1024, 1024);
  fireLight.shadow.bias = -0.002;
  fireLight.shadow.camera.near = 0.3;
  room.add(fireLight);
  lights.fire = fireLight;
  animated.push((t) => {
    const f = 0.82 + 0.1 * Math.sin(t * 7.3) + 0.06 * Math.sin(t * 13.1 + 1) + 0.05 * Math.sin(t * 23.7);
    fireLight.intensity = 40 * f;
    coals.material.opacity = 0.45 + 0.2 * f;
    logMat.emissiveIntensity = 1.1 + f * 0.8;
  });

  /* ----------------------------------------------------------- lion head */
  room.add(lionHead(gold, [0, 6.25, -HALF + 1.25]));

  /* ---------------------------------------------------- window & moonlight */
  const win = new THREE.Group();
  win.position.set(-6, 0, -HALF);
  room.add(win);
  const W2 = 0.95, SILL = 2.2, SPRING = 5.5, APEX = 6.7;
  const winPath = (w) => {
    const p = new THREE.Path();
    p.moveTo(-w, SILL); p.lineTo(-w, SPRING);
    p.quadraticCurveTo(-w, SPRING + (APEX - SPRING) * 0.75, 0, APEX + (w - W2) * 0.6);
    p.quadraticCurveTo(w, SPRING + (APEX - SPRING) * 0.75, w, SPRING);
    p.lineTo(w, SILL); p.closePath();
    return p;
  };
  const frameShape = new THREE.Shape();
  frameShape.moveTo(-1.45, SILL - 0.35); frameShape.lineTo(1.45, SILL - 0.35); frameShape.lineTo(1.45, APEX + 0.6); frameShape.lineTo(-1.45, APEX + 0.6); frameShape.closePath();
  frameShape.holes.push(winPath(W2));
  add(win, new THREE.ExtrudeGeometry(frameShape, { depth: 0.55, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 2, curveSegments: 24 }), carvedStone, [0, 0, 0.02]);
  // reveal (deep jambs give the wall thickness)
  const sky = nightSkyMaterial();
  flames.push(sky);
  const skyMesh = add(win, new THREE.PlaneGeometry(2 * W2 + 0.1, APEX - SILL + 0.2), sky, [0, (APEX + SILL) / 2, 0.01], [0, 0, 0], { cast: false, receive: false });
  skyMesh.renderOrder = -1;
  // leaded glass: diamond lattice over a faint tint
  const [lc, lx] = makeCanvas(256, 1024);
  lx.fillStyle = "rgba(120,150,200,.10)"; lx.fillRect(0, 0, 256, 1024);
  lx.strokeStyle = "rgba(10,10,14,.95)"; lx.lineWidth = 3;
  for (let k = -1024; k < 1280; k += 48) {
    lx.beginPath(); lx.moveTo(k, 0); lx.lineTo(k + 1024, 1024); lx.stroke();
    lx.beginPath(); lx.moveTo(k + 1024, 0); lx.lineTo(k, 1024); lx.stroke();
  }
  const leaded = new THREE.MeshStandardMaterial({ map: canvasTexture(lc, { wrap: false }), transparent: true, roughness: 0.2, metalness: 0.3 });
  add(win, new THREE.PlaneGeometry(2 * W2 + 0.1, APEX - SILL + 0.2), leaded, [0, (APEX + SILL) / 2, 0.05], [0, 0, 0], { cast: false });
  // stone mullion, transoms and tracery
  add(win, new THREE.BoxGeometry(0.12, APEX - SILL, 0.18), carvedStone, [0, (APEX + SILL) / 2 - 0.1, 0.12]);
  for (const y of [3.4, 4.6]) add(win, new THREE.BoxGeometry(2 * W2, 0.09, 0.14), carvedStone, [0, y, 0.12]);
  add(win, new THREE.TorusGeometry(0.34, 0.05, 8, 40), carvedStone, [0, 5.95, 0.14]);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + Math.PI / 4; add(win, new THREE.TorusGeometry(0.13, 0.03, 8, 24), carvedStone, [Math.cos(a) * 0.17, 5.95 + Math.sin(a) * 0.17, 0.14]); }
  add(win, new THREE.BoxGeometry(2.7, 0.14, 0.75), carvedStone, [0, SILL - 0.4, 0.4]);
  add(win, new THREE.BoxGeometry(2.72, 0.04, 0.77), gold, [0, SILL - 0.32, 0.4]);

  // moonlight: a spotlight shaped by the window's pattern, plus a visible beam
  const moonTarget = new THREE.Object3D();
  moonTarget.position.set(-3.4, 0, -4.8);
  room.add(moonTarget);
  const moon = new THREE.SpotLight(0x9db4ff, 140, 0, 0.42, 0.55, 1.2);
  moon.position.set(-6.4, 6.2, -HALF + 0.3);
  moon.target = moonTarget;
  moon.map = windowCookie();
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  moon.shadow.bias = -0.0015;
  room.add(moon);
  lights.moon = moon;

  const beamStart = v3(-6, 4.4, -HALF + 0.3), beamEnd = v3(-3.4, 0, -4.8);
  const beamDir = new THREE.Vector3().subVectors(beamEnd, beamStart);
  const beamLen = beamDir.length();
  const beam = new THREE.Group();
  beam.position.copy(beamStart);
  beam.quaternion.setFromUnitVectors(v3(0, -1, 0), beamDir.clone().normalize());
  room.add(beam);
  const shaft = moonbeamMaterial();
  flames.push(shaft);
  const shaftGeo = new THREE.CylinderGeometry(0.95, 1.9, beamLen, 32, 1, true);
  shaftGeo.translate(0, -beamLen / 2, 0);
  // flip UV so v runs 0 at the window → 1 at the floor
  const uvs = shaftGeo.attributes.uv;
  for (let i = 0; i < uvs.count; i++) uvs.setY(i, 1 - uvs.getY(i));
  const shaftMesh = add(beam, shaftGeo, shaft, [0, 0, 0], [0, 0, 0], { cast: false, receive: false });
  shaftMesh.scale.set(1, 1, 0.55);
  shaftMesh.renderOrder = 4;
  const dustMat = particleMaterial(PARTICLE_MODES.dust, 0xbcd0ff, { size: 0.7 });
  const dust = particles(160, dustMat, 11);
  dust.scale.set(1.6, -beamLen, 1.0);
  beam.add(dust);
  flames.push(dustMat);

  /* ------------------------------------------------------ crest opposite */
  room.add(wallCrest(gold, iron, velvet, [6, 4.3, -HALF + 0.05]));

  /* -------------------------------------------------------------- banners */
  [[-HALF + 0.12, Math.PI / 2, 0], [HALF - 0.12, -Math.PI / 2, 1]].forEach(([x, ry, variant]) => {
    const { group, update } = banner(gold, variant);
    group.position.set(x, 0, -3.2);
    group.rotation.y = ry;
    room.add(group);
    animated.push(update);
  });

  /* ------------------------------------------------------ torches/sconces */
  for (const x of [-3.9, 3.9]) {
    const { group, flame, light } = sconce(iron, gold);
    group.position.set(x, 3.4, -HALF + 0.05);
    room.add(group);
    flames.push(flame);
    animated.push((t) => { light.intensity = 5 * (0.85 + 0.15 * Math.sin(t * 9 + x)); });
  }

  /* --------------------------------------------------------------- armour */
  const steel = new THREE.MeshStandardMaterial({ color: 0xaab4c4, metalness: 0.9, roughness: 0.3, envMapIntensity: 0.6 });
  const crimson = new THREE.MeshStandardMaterial({ color: 0x7a1020, roughness: 0.85, side: THREE.DoubleSide });
  const leather = new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.8 });
  for (const [x, z] of [[-8.3, -8.3], [8.3, -8.3], [-8.3, 8.3], [8.3, 8.3]]) {
    const suit = armour(steel, gold, crimson, leather, darkStone);
    suit.position.set(x, 0, z);
    suit.rotation.y = Math.atan2(-x, -z);
    room.add(suit);
  }

  /* ----------------------------------------------------------- chandelier */
  const ch = chandelier(iron, gold);
  ch.group.position.set(0, 7.3, 0);
  room.add(ch.group);
  flames.push(...ch.flames);
  lights.chandelier = ch.light;
  animated.push((t) => { ch.light.intensity = 38 * (0.93 + 0.04 * Math.sin(t * 5.1) + 0.03 * Math.sin(t * 11.7)); });

  return { room, animated, flames, lights };
}

/* ======================================================================= */

/** Gilded lion head mounted on a crimson shield, a ring through its jaws. */
function lionHead(gold, pos) {
  const b = new MergeBuilder();
  const r = rng(17);
  const darkGold = new THREE.MeshStandardMaterial({ color: 0x9a7030, metalness: 1, roughness: 0.38 });
  const shieldRed = new THREE.MeshStandardMaterial({ color: 0x6a0c18, roughness: 0.6, metalness: 0.2 });
  const ivory = new THREE.MeshStandardMaterial({ color: 0xf0e6cc, roughness: 0.4 });
  const mouth = new THREE.MeshStandardMaterial({ color: 0x2a0406, roughness: 0.8 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffb030, emissive: 0xff8a10, emissiveIntensity: 3 });

  // shield plaque
  const sh = new THREE.Shape();
  sh.moveTo(-0.95, 1.05); sh.lineTo(0.95, 1.05); sh.lineTo(0.95, 0);
  sh.quadraticCurveTo(0.9, -0.85, 0, -1.25); sh.quadraticCurveTo(-0.9, -0.85, -0.95, 0); sh.closePath();
  b.add(new THREE.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3 }), shieldRed);
  const rim = new THREE.Shape(sh.getPoints(48));
  const inner = new THREE.Path(sh.getPoints(48).map((p) => p.clone().multiplyScalar(0.9)).reverse());
  rim.holes.push(inner);
  b.add(new THREE.ExtrudeGeometry(rim, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 }), gold);

  // mane: layered locks sweeping outward, tips curling back toward the wall
  const Z = 0.12;
  [[0.62, 26, 0.07, -0.02], [0.5, 22, 0.075, 0.07], [0.4, 18, 0.07, 0.15]].forEach(([rad, n, thick, z0], ring) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + ring * 0.11 + (r() - 0.5) * 0.06;
      const sw = 0.1 + r() * 0.08;
      const d = (ang, k) => [Math.cos(ang) * rad * k, Math.sin(ang) * rad * k * 1.1 - 0.04];
      const [x0, y0] = d(a, 0.72), [x1, y1] = d(a + sw * 0.4, 1.05), [x2, y2] = d(a + sw, 1.32), [x3, y3] = d(a + sw * 0.6, 1.5);
      const pts = [v3(x0, y0, Z + z0 + 0.16), v3(x1, y1, Z + z0 + 0.14), v3(x2, y2, Z + z0 + 0.05), v3(x3, y3, Z + z0 - 0.06)];
      b.add(taperTube(pts, (t) => thick * (1 - t * 0.8) + 0.008, { tubular: 24, radial: 8 }), ring === 1 ? darkGold : gold);
    }
  });
  // beard beneath the jaw
  for (let i = 0; i < 9; i++) {
    const x = (i - 4) * 0.045, len = 0.22 - Math.abs(i - 4) * 0.025;
    b.add(taperTube([v3(x, -0.36, Z + 0.4), v3(x * 1.2, -0.46, Z + 0.38), v3(x * 1.1, -0.36 - len - 0.1, Z + 0.3)], (t) => 0.035 * (1 - t) + 0.006, { tubular: 16, radial: 8 }), i % 2 ? darkGold : gold);
  }

  const S = (geo, m, p, s = [1, 1, 1], rot = [0, 0, 0]) => b.add(geo, m, mat(p, rot, s));
  const sphere = (rr, w = 28, h = 20) => new THREE.SphereGeometry(rr, w, h);
  S(sphere(0.36), gold, [0, 0.04, Z + 0.26], [1, 1.05, 0.9]);                       // skull
  S(sphere(0.2), gold, [0, 0.2, Z + 0.46], [1.2, 0.55, 0.7]);                       // brow mass
  S(sphere(0.19), gold, [0, -0.13, Z + 0.54], [1.05, 0.85, 1.05]);                  // muzzle
  S(sphere(0.11), gold, [0, 0.04, Z + 0.62], [0.55, 1.2, 0.6], [0.35, 0, 0]);       // bridge of the nose
  S(sphere(0.085), darkGold, [0, -0.04, Z + 0.72], [1.5, 0.85, 0.9]);               // nose
  for (const sx of [-1, 1]) {
    S(sphere(0.15), gold, [sx * 0.16, -0.16, Z + 0.5], [1, 0.85, 1]);               // whisker pads
    S(new THREE.CapsuleGeometry(0.045, 0.16, 6, 12), gold, [sx * 0.13, 0.17, Z + 0.56], [1, 1, 1], [0, 0, sx * 1.25]); // brow ridge
    S(sphere(0.05, 18, 14), darkGold, [sx * 0.13, 0.08, Z + 0.55], [1.2, 0.8, 0.8]); // eye socket
    S(sphere(0.036, 16, 12), eyeMat, [sx * 0.13, 0.085, Z + 0.585]);                 // eyes
    S(sphere(0.1), gold, [sx * 0.3, 0.33, Z + 0.2], [1, 1, 0.5]);                    // ears
    S(sphere(0.055), darkGold, [sx * 0.3, 0.33, Z + 0.25], [1, 1, 0.4]);
    S(new THREE.ConeGeometry(0.02, 0.1, 8), ivory, [sx * 0.07, -0.3, Z + 0.64], [1, 1, 1], [Math.PI, 0, 0]); // upper fangs
    S(new THREE.ConeGeometry(0.016, 0.07, 8), ivory, [sx * 0.065, -0.41, Z + 0.6]);  // lower fangs
    for (let k = 0; k < 3; k++) S(sphere(0.012, 8, 6), darkGold, [sx * (0.12 + k * 0.045), -0.13 - k * 0.025, Z + 0.66 - k * 0.02]); // whisker dots
  }
  S(sphere(0.12), mouth, [0, -0.33, Z + 0.55], [1.1, 0.75, 0.9]);                  // open maw
  S(sphere(0.13), gold, [0, -0.45, Z + 0.48], [1, 0.5, 0.95]);                     // lower jaw
  S(new THREE.TorusGeometry(0.17, 0.026, 12, 40), gold, [0, -0.6, Z + 0.62], [1, 1, 1], [0.35, 0, 0]); // ring
  const g = b.build();
  g.position.set(...pos);
  return g;
}

/** Heraldic shield with crossed swords, hung opposite the window. */
function wallCrest(gold, iron, velvet, pos) {
  const b = new MergeBuilder();
  const sh = new THREE.Shape();
  sh.moveTo(-0.8, 0.9); sh.lineTo(0.8, 0.9); sh.lineTo(0.8, 0); sh.quadraticCurveTo(0.75, -0.7, 0, -1.05); sh.quadraticCurveTo(-0.75, -0.7, -0.8, 0); sh.closePath();
  b.add(new THREE.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 }), velvet, mat([0, 0, 0.2]));
  const rim = new THREE.Shape(sh.getPoints(48));
  rim.holes.push(new THREE.Path(sh.getPoints(48).map((p) => p.clone().multiplyScalar(0.88)).reverse()));
  b.add(new THREE.ExtrudeGeometry(rim, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 }), gold, mat([0, 0, 0.2]));
  // chevron and three crowns
  const chev = new THREE.Shape();
  chev.moveTo(-0.7, -0.35); chev.lineTo(0, 0.25); chev.lineTo(0.7, -0.35); chev.lineTo(0.7, -0.15); chev.lineTo(0, 0.45); chev.lineTo(-0.7, -0.15); chev.closePath();
  b.add(new THREE.ExtrudeGeometry(chev, { depth: 0.03, bevelEnabled: false }), gold, mat([0, 0, 0.33]));
  // crossed swords behind the shield
  const steel = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 1, roughness: 0.25 });
  for (const s of [-1, 1]) {
    const rot = [0, 0, s * 0.72];
    b.add(new THREE.BoxGeometry(0.1, 2.6, 0.025), steel, mat([0, 0, 0.12], rot));
    const m = new THREE.Matrix4().makeRotationZ(s * 0.72);
    const place = (x, y) => new THREE.Vector3(x, y, 0).applyMatrix4(m);
    const gp = place(0, -1.3), hp = place(0, -1.55), pp = place(0, -1.72), tp = place(0, 1.36);
    b.add(new THREE.BoxGeometry(0.5, 0.07, 0.07), gold, mat([gp.x, gp.y, 0.13], rot));
    b.add(new THREE.CylinderGeometry(0.035, 0.035, 0.4, 10), iron, mat([hp.x, hp.y, 0.13], rot));
    b.add(new THREE.SphereGeometry(0.07, 12, 10), gold, mat([pp.x, pp.y, 0.13]));
    b.add(new THREE.ConeGeometry(0.05, 0.15, 4), steel, mat([tp.x, tp.y, 0.12], rot));
  }
  const g = b.build();
  g.position.set(...pos);
  return g;
}

/** A crimson and gold banner on a gilded rod, gently stirring. */
function banner(gold, variant) {
  const group = new THREE.Group();
  const W = 1.7, H = 4.3, TOP = 8.1;
  const geo = new THREE.PlaneGeometry(W, H, 14, 36);
  const base = geo.attributes.position.array.slice();
  const cloth = new THREE.MeshStandardMaterial({ map: bannerCloth(31 + variant, variant), side: THREE.DoubleSide, alphaTest: 0.5, roughness: 0.85 });
  const mesh = new THREE.Mesh(geo, cloth);
  mesh.position.set(0, TOP - H / 2, 0.14);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  const b = new MergeBuilder();
  b.add(new THREE.CylinderGeometry(0.035, 0.035, W + 0.5, 12), gold, mat([0, TOP + 0.04, 0.16], [0, 0, Math.PI / 2]));
  for (const s of [-1, 1]) {
    b.add(new THREE.SphereGeometry(0.07, 14, 10), gold, mat([s * (W / 2 + 0.28), TOP + 0.04, 0.16]));
    b.add(new THREE.ConeGeometry(0.045, 0.2, 8), gold, mat([s * (W / 2 + 0.42), TOP + 0.04, 0.16], [0, 0, -s * Math.PI / 2]));
    b.add(new THREE.CylinderGeometry(0.015, 0.015, 0.25, 8), gold, mat([s * (W / 2 + 0.1), TOP + 0.13, 0.08], [0.5, 0, 0]));
  }
  // tassel cords
  for (const s of [-1, 1]) {
    b.add(taperTube([v3(s * 0.75, TOP, 0.2), v3(s * 0.85, TOP - 0.8, 0.24), v3(s * 0.9, TOP - 1.6, 0.22)], 0.012, { tubular: 20, radial: 6 }), gold);
    b.add(new THREE.ConeGeometry(0.06, 0.28, 12), gold, mat([s * 0.9, TOP - 1.72, 0.22]));
  }
  group.add(b.build());
  const pos = geo.attributes.position;
  const update = (t) => {
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3], y = base[i * 3 + 1];
      const hang = (H / 2 - y) / H; // 0 at the rod → 1 at the tails
      pos.setZ(i, (Math.sin(y * 1.6 + t * 1.1 + x * 0.8) * 0.05 + Math.sin(t * 0.6 + x) * 0.03) * hang);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  };
  update(0);
  return { group, update };
}

/** Iron wall torch with a real flame and warm light. */
function sconce(iron, gold) {
  const group = new THREE.Group();
  const b = new MergeBuilder();
  b.add(new THREE.BoxGeometry(0.22, 0.4, 0.05), iron, mat([0, 0, 0.03]));
  b.add(taperTube([v3(0, -0.1, 0.05), v3(0, -0.05, 0.3), v3(0, 0.12, 0.42)], 0.025, { tubular: 16, radial: 8 }), iron);
  b.add(new THREE.CylinderGeometry(0.1, 0.06, 0.14, 12, 1, true), iron, mat([0, 0.2, 0.45]));
  b.add(new THREE.TorusGeometry(0.1, 0.012, 8, 20), gold, mat([0, 0.27, 0.45], [Math.PI / 2, 0, 0]));
  b.add(new THREE.CylinderGeometry(0.045, 0.035, 0.5, 10), new THREE.MeshStandardMaterial({ color: 0x3a2412, roughness: 0.9 }), mat([0, 0.3, 0.45]));
  group.add(b.build());
  const flame = flameMaterial({ seed: Math.random() * 10, intensity: 2.4 });
  for (const ry of [0, Math.PI / 2]) {
    const q = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.6), flame);
    q.position.set(0, 0.8, 0.45);
    q.rotation.y = ry;
    q.renderOrder = 3;
    group.add(q);
  }
  const light = new THREE.PointLight(0xffa050, 5, 0, 1.6);
  light.position.set(0, 0.85, 0.6);
  group.add(light);
  return { group, flame, light };
}

/** Plate armour standing guard on a plinth, hands resting on a greatsword. */
function armour(steel, gold, crimson, leather, stone) {
  const b = new MergeBuilder();
  const P = 0.38; // plinth height
  const lathe = (pts, n = 28) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), n);
  const at = (x, y, z) => v3(x, y + P, z);

  // plinth
  b.add(new THREE.BoxGeometry(1.0, P, 1.0), stone, mat([0, P / 2, 0]));
  b.add(new THREE.BoxGeometry(1.04, 0.04, 1.04), gold, mat([0, P, 0]));

  for (const sx of [-1, 1]) {
    const x = sx * 0.12;
    b.add(new THREE.CapsuleGeometry(0.05, 0.17, 6, 12), steel, mat([x, P + 0.05, 0.05], [Math.PI / 2, 0, 0], [1.1, 1, 0.7]));   // sabaton
    b.add(lathe([[0.058, 0], [0.07, 0.12], [0.085, 0.28], [0.078, 0.42], [0.07, 0.44]]), steel, mat([x, P + 0.08, 0]));       // greave
    b.add(new THREE.SphereGeometry(0.075, 16, 12), steel, mat([x, P + 0.54, 0.02]));                                             // poleyn
    b.add(new THREE.CylinderGeometry(0.075, 0.075, 0.012, 20), gold, mat([x + sx * 0.06, P + 0.54, 0.01], [0, 0, Math.PI / 2]));
    b.add(lathe([[0.08, 0], [0.095, 0.18], [0.11, 0.32], [0.1, 0.34]]), steel, mat([x, P + 0.58, 0]));                            // cuisse
  }
  // tassets, fauld and belt
  for (let k = 0; k < 3; k++) b.add(new THREE.CylinderGeometry(0.21 + k * 0.012, 0.23 + k * 0.012, 0.09, 28, 1, true, -Math.PI * 0.75, Math.PI * 1.5), steel, mat([0, P + 0.98 - k * 0.075, 0]));
  b.add(new THREE.TorusGeometry(0.2, 0.018, 8, 32), leather, mat([0, P + 1.04, 0], [Math.PI / 2, 0, 0]));
  b.add(new THREE.BoxGeometry(0.07, 0.06, 0.02), gold, mat([0, P + 1.04, 0.2]));
  // cuirass
  b.add(lathe([[0.19, 0], [0.22, 0.12], [0.25, 0.3], [0.25, 0.42], [0.2, 0.5], [0.12, 0.54], [0, 0.54]], 36), steel, mat([0, P + 1.05, 0], [0, 0, 0], [1, 1, 0.78]));
  b.add(new THREE.BoxGeometry(0.02, 0.44, 0.03), gold, mat([0, P + 1.3, 0.19], [-0.12, 0, 0]));
  b.add(new THREE.TorusGeometry(0.19, 0.012, 8, 36), gold, mat([0, P + 1.06, 0], [Math.PI / 2, 0, 0], [1, 0.78, 1]));
  // gorget
  for (let k = 0; k < 3; k++) b.add(new THREE.TorusGeometry(0.11 - k * 0.012, 0.022, 8, 24), k === 1 ? gold : steel, mat([0, P + 1.6 + k * 0.035, 0], [Math.PI / 2, 0, 0]));
  // pauldrons
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      b.add(new THREE.SphereGeometry(0.13 - k * 0.012, 18, 10, 0, TAU, 0, Math.PI / 2), steel, mat([sx * (0.25 + k * 0.02), P + 1.52 - k * 0.055, 0], [0, 0, -sx * (0.5 + k * 0.1)]));
    }
    b.add(new THREE.TorusGeometry(0.105, 0.01, 8, 24), gold, mat([sx * 0.29, P + 1.41, 0], [Math.PI / 2, 0, -sx * 0.7]));
  }
  // arms: resting both gauntlets on the pommel of a greatsword planted in front
  const handY = [1.13, 1.05];
  for (const [i, sx] of [[0, -1], [1, 1]]) {
    const S = at(sx * 0.27, 1.46, 0), E = at(sx * 0.29, 1.17, 0.14), H = at(sx * 0.035, handY[i], 0.33);
    b.add(limb(S, E, 0.058, 0.05), steel);
    b.add(new THREE.SphereGeometry(0.058, 14, 10), steel, mat([E.x, E.y, E.z]));
    b.add(new THREE.CylinderGeometry(0.06, 0.06, 0.012, 16), gold, mat([E.x + sx * 0.05, E.y, E.z], [0, 0, Math.PI / 2]));
    b.add(limb(E, H, 0.05, 0.045), steel);
    b.add(new THREE.CylinderGeometry(0.06, 0.05, 0.08, 14), steel, mat([H.x, H.y, H.z - 0.05], [Math.PI / 2 - 0.3, 0, 0]));
    b.add(new THREE.BoxGeometry(0.075, 0.075, 0.1), steel, mat([H.x, H.y, H.z + 0.01]));
  }
  // greatsword
  const blade = new THREE.Shape();
  blade.moveTo(0, 0); blade.lineTo(0.035, 0.12); blade.lineTo(0.035, 0.9); blade.lineTo(-0.035, 0.9); blade.lineTo(-0.035, 0.12); blade.closePath();
  const bg = new THREE.ExtrudeGeometry(blade, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.008, bevelSegments: 1 });
  b.add(bg, steel, mat([0, P + 0.02, 0.33]));
  b.add(new THREE.BoxGeometry(0.34, 0.035, 0.04), gold, mat([0, P + 0.93, 0.33]));
  for (const sx of [-1, 1]) b.add(new THREE.SphereGeometry(0.026, 10, 8), gold, mat([sx * 0.17, P + 0.93, 0.33]));
  b.add(new THREE.CylinderGeometry(0.02, 0.02, 0.24, 10), leather, mat([0, P + 1.07, 0.33]));
  b.add(new THREE.SphereGeometry(0.04, 14, 10), gold, mat([0, P + 1.22, 0.33]));
  // helm: rounded bascinet with a pointed visor and a crimson plume
  b.add(new THREE.SphereGeometry(0.135, 24, 18), steel, mat([0, P + 1.8, 0], [0, 0, 0], [0.95, 1.12, 1.05]));
  b.add(new THREE.ConeGeometry(0.11, 0.2, 18), steel, mat([0, P + 1.77, 0.13], [Math.PI / 2, 0, 0], [1, 1, 0.8]));
  for (const y of [1.8, 1.77]) b.add(new THREE.BoxGeometry(0.16, 0.012, 0.03), leather, mat([0, P + y, 0.175]));
  b.add(new THREE.BoxGeometry(0.02, 0.28, 0.24), gold, mat([0, P + 1.88, 0]));
  for (let k = 0; k < 5; k++) {
    const dz = -0.02 - k * 0.02, lean = (k - 2) * 0.05;
    b.add(taperTube([v3(lean * 0.3, P + 1.94, dz), v3(lean, P + 2.12, dz - 0.08), v3(lean * 1.6, P + 2.1, dz - 0.3), v3(lean * 2, P + 1.86, dz - 0.42)], (t) => 0.03 * (1 - t) + 0.006, { tubular: 24, radial: 8 }), crimson);
  }
  // cape
  const cape = new THREE.CylinderGeometry(0.3, 0.42, 1.25, 20, 6, true, Math.PI * 0.6, Math.PI * 0.8);
  b.add(cape, crimson, mat([0, P + 0.95, -0.02]));
  return b.build();
}

/** Wrought-iron ring chandelier with twelve candles. */
function chandelier(iron, gold) {
  const group = new THREE.Group();
  const b = new MergeBuilder();
  const flames = [];
  const R = 1.4, N = 12;
  b.add(new THREE.TorusGeometry(R, 0.04, 10, 64), iron, mat([0, 0, 0], [Math.PI / 2, 0, 0]));
  b.add(new THREE.TorusGeometry(R + 0.03, 0.014, 8, 64), gold, mat([0, 0.05, 0], [Math.PI / 2, 0, 0]));
  b.add(new THREE.TorusGeometry(0.5, 0.03, 8, 40), iron, mat([0, -0.35, 0], [Math.PI / 2, 0, 0]));
  b.add(new THREE.SphereGeometry(0.16, 16, 12), gold, mat([0, -0.35, 0]));
  b.add(new THREE.ConeGeometry(0.08, 0.3, 12), gold, mat([0, -0.6, 0], [Math.PI, 0, 0]));
  const wax = new THREE.MeshStandardMaterial({ color: 0xf2e6c8, roughness: 0.6, emissive: 0x6a4a20, emissiveIntensity: 0.2 });
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    const x = Math.cos(a) * R, z = Math.sin(a) * R;
    if (i % 3 === 0) b.add(taperTube([v3(Math.cos(a) * 0.5, -0.35, Math.sin(a) * 0.5), v3(Math.cos(a) * 0.95, -0.25, Math.sin(a) * 0.95), v3(x, 0, z)], 0.022, { tubular: 16, radial: 6 }), iron);
    b.add(new THREE.CylinderGeometry(0.07, 0.04, 0.06, 12), gold, mat([x, 0.05, z]));
    b.add(new THREE.CylinderGeometry(0.035, 0.035, 0.28, 12), wax, mat([x, 0.22, z]));
    const fm = flameMaterial({ seed: i * 2.1, intensity: 2.2 });
    flames.push(fm);
    for (const ry of [0, Math.PI / 2]) {
      const q = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.2), fm);
      q.position.set(x, 0.45, z);
      q.rotation.y = ry + a;
      q.renderOrder = 3;
      group.add(q);
    }
  }
  // chains to the ceiling
  const link = new THREE.TorusGeometry(0.05, 0.012, 6, 12);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * TAU;
    const from = v3(Math.cos(a) * R, 0, Math.sin(a) * R), to = v3(0, 2.7, 0);
    for (let i = 0; i < 40; i++) {
      const t = i / 40, p = from.clone().lerp(to, t);
      b.add(link, iron, mat([p.x, p.y, p.z], [0, a + (i % 2) * Math.PI / 2, Math.PI / 2 - Math.atan2(2.7, R)]));
    }
  }
  group.add(b.build({ castShadow: true }));
  const light = new THREE.PointLight(0xffc27a, 38, 0, 1.4);
  light.position.set(0, -0.9, 0);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  light.shadow.bias = -0.002;
  light.shadow.camera.near = 0.2;
  group.add(light);
  return { group, flames, light };
}
