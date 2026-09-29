/*
 * The Great Hall: a 3D home page. Builds the scene, runs the render loop and
 * handles looking around, hovering and choosing swords.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { createRoom, HALF, HEIGHT } from "./room.js";
import { createTable, TABLE_TOP, SWORD_RING } from "./table3d.js";
import { createSword, updateSword } from "./swords3d.js";
import { TAU } from "./util.js";

const ui = {
  stage: document.getElementById("stage"),
  loader: document.getElementById("loader"),
  label: document.getElementById("blade-label"),
  labelElement: document.querySelector("#blade-label .label-element"),
  labelTitle: document.querySelector("#blade-label .label-title"),
  hint: document.getElementById("hint"),
  roll: document.getElementById("blade-roll"),
  views: document.querySelectorAll("[data-view]"),
};
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* -------------------------------------------------- the blade roll (HTML) */
ui.roll.innerHTML = SWORDS.map((s, i) => `
  <li><a href="${s.href}" data-index="${i}" style="--glow:${ELEMENTS[s.element].glow}">
    <span class="roll-element">${ELEMENTS[s.element].label}</span>
    <span class="roll-title">${s.title}</span>
  </a></li>`).join("");

/* ------------------------------------------------------------ WebGL check */
function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGL2RenderingContext && c.getContext("webgl2"));
  } catch { return false; }
}
if (!webglAvailable()) {
  document.body.classList.add("no-webgl");
  ui.loader.remove();
  throw new Error("WebGL2 unavailable; showing the blade roll instead.");
}

/* ------------------------------------------------------ renderer & scene */
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
const small = window.matchMedia("(max-width: 720px)").matches;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.25 : 1.75));
if (small) document.querySelector(".roll-panel").removeAttribute("open");
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
ui.stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050304);
scene.fog = new THREE.FogExp2(0x0a0608, 0.018);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.05, 60);
const HOME = small
  ? { pos: new THREE.Vector3(0, 5.2, 8.8), target: new THREE.Vector3(0, 1.4, -0.2) }
  : { pos: new THREE.Vector3(0, 5.0, 7.6), target: new THREE.Vector3(0, 1.35, -0.3) };
camera.position.copy(HOME.pos);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(HOME.target);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 0.5;
controls.maxDistance = 12.5;
controls.maxPolarAngle = Math.PI * 0.495;
controls.zoomSpeed = 0.9;
controls.rotateSpeed = 0.55;
controls.screenSpacePanning = true;

/* --------------------------------------------------------------- lighting */
scene.add(new THREE.HemisphereLight(0x3a4a7a, 0x1a0c06, 0.35));
scene.add(new THREE.AmbientLight(0x251820, 0.4));

/* ------------------------------------------------------------ the scene */
await document.fonts.ready;
await Promise.all(["700 40px Cinzel", "400 40px 'Pirata One'"].map((f) => document.fonts.load(f).catch(() => {})));

const { room, animated, flames, lights } = createRoom();
scene.add(room);

const table = await createTable(SWORDS, ELEMENTS, OWNER.name);
scene.add(table);

const swords = SWORDS.map((s, i) => {
  const glow = ELEMENTS[s.element].glow;
  const a = (i / SWORDS.length) * TAU;
  const outward = new THREE.Vector3(Math.sin(a), 0, -Math.cos(a));
  const sw = createSword(s.element, glow, i, outward);
  sw.root.position.set(outward.x * SWORD_RING, TABLE_TOP, outward.z * SWORD_RING);
  sw.index = i;
  scene.add(sw.root);
  return sw;
});
const hitTargets = swords.map((s) => s.hit);

// light that follows the sword under the cursor
const hoverLight = new THREE.PointLight(0xffffff, 0, 4.5, 1.5);
scene.add(hoverLight);

// reflections: capture the lit hall once so polished metal has something to mirror
{
  renderer.shadowMap.needsUpdate = true;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const hide = swords.map((s) => s.root);
  hide.forEach((o) => (o.visible = false));
  const envScene = scene;
  const rt = pmrem.fromScene(envScene, 0.02, 0.1, 40);
  hide.forEach((o) => (o.visible = true));
  scene.environment = rt.texture;
  scene.environmentIntensity = 0.9;
  pmrem.dispose();
}
renderer.shadowMap.needsUpdate = true;

/* -------------------------------------------------------- post-processing */
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { samples: 4, type: THREE.HalfFloatType }));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), 0.55, 0.5, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function fitLens() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.fov = camera.aspect < 0.8 ? 68 : 50;
  camera.updateProjectionMatrix();
}
fitLens();

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  fitLens();
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloom.resolution.set(w / 2, h / 2);
}
window.addEventListener("resize", resize);

/* ------------------------------------------------------------ camera moves */
let flight = null;
function flyTo(pos, target, duration = 1.6) {
  if (reduceMotion) duration = 0.01;
  flight = { fromPos: camera.position.clone(), fromTarget: controls.target.clone(), pos: pos.clone(), target: target.clone(), t: 0, duration };
}
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

const armourCorners = [[-8.3, -8.3], [8.3, -8.3], [8.3, 8.3], [-8.3, 8.3]];
let armourIndex = 0;
const VIEWS = {
  table: () => [HOME.pos, HOME.target],
  above: () => [new THREE.Vector3(0, 6.1, 1.5), new THREE.Vector3(0, TABLE_TOP, 0.1)],
  hearth: () => [new THREE.Vector3(0, 3.6, -2.6), new THREE.Vector3(0, 4.3, -HALF)],
  window: () => [new THREE.Vector3(-2.6, 2.6, -4.2), new THREE.Vector3(-6, 4.2, -HALF)],
  armour: () => {
    const [x, z] = armourCorners[armourIndex++ % 4];
    const target = new THREE.Vector3(x, 1.6, z);
    const pos = target.clone().add(new THREE.Vector3(-Math.sign(x) * 2.4, 0.5, -Math.sign(z) * 2.4));
    return [pos, target];
  },
};
ui.views.forEach((btn) => btn.addEventListener("click", () => {
  const [p, t] = VIEWS[btn.dataset.view]();
  flyTo(p, t);
}));

/* ------------------------------------------------------------ interaction */
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hovered = null;
let chosen = null;
let downAt = null;

function setHovered(sw) {
  if (chosen || sw === hovered) return;
  if (hovered) { hovered.target = 0.35; hovered.liftTarget = 0; }
  hovered = sw;
  document.querySelectorAll("#blade-roll a").forEach((a) => a.classList.toggle("is-active", sw && Number(a.dataset.index) === sw.index));
  if (sw) {
    sw.target = 1.25;
    sw.liftTarget = 1;
    const s = SWORDS[sw.index];
    ui.labelElement.textContent = `The Blade of ${ELEMENTS[s.element].label}`;
    ui.labelTitle.textContent = s.title;
    ui.label.style.setProperty("--glow", ELEMENTS[s.element].glow);
    ui.label.classList.toggle("is-visible", pointerDriven);
    hoverLight.color.set(ELEMENTS[s.element].glow);
    // light the sword from just outside it, never from inside the blade
    sw.focus.getWorldPosition(hoverLight.position);
    hoverLight.position.add(hoverLight.position.clone().setY(0).normalize().multiplyScalar(0.9)).add(new THREE.Vector3(0, 0.4, 0));
    renderer.domElement.style.cursor = "pointer";
  } else {
    ui.label.classList.remove("is-visible");
    renderer.domElement.style.cursor = "";
  }
}

function pick(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(hitTargets, false)[0];
  return hit ? hit.object.userData.sword : null;
}
let pointerDriven = false;

function placeLabel(event) {
  ui.label.style.transform = `translate(${event.clientX + 18}px, ${event.clientY + 14}px)`;
}

function choose(sw) {
  if (chosen) return;
  setHovered(sw);
  chosen = sw;
  sw.target = 3;
  sw.shockStart = clock.elapsedTime;
  const s = SWORDS[sw.index];
  const focus = sw.focus.getWorldPosition(new THREE.Vector3());
  const outward = focus.clone().setY(0).normalize();
  flyTo(focus.clone().add(outward.multiplyScalar(2.2)).add(new THREE.Vector3(0, 0.6, 0)), focus, 1.1);
  document.body.classList.add("is-chosen");
  document.body.style.setProperty("--glow", ELEMENTS[s.element].glow);
  setTimeout(() => { window.location.href = s.href; }, reduceMotion ? 150 : 1250);
}

renderer.domElement.addEventListener("pointermove", (e) => {
  if (e.pointerType === "mouse") { pointerDriven = true; placeLabel(e); setHovered(pick(e)); }
});
renderer.domElement.addEventListener("pointerdown", (e) => { downAt = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener("pointerup", (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
  const sw = pick(e);
  if (sw) { placeLabel(e); choose(sw); }
});
renderer.domElement.addEventListener("pointerleave", () => setHovered(null));

// double-click anything to walk up and inspect it
renderer.domElement.addEventListener("dblclick", (e) => {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(scene.children, true).find((h) => h.object.visible && h.object.material && h.object.material.visible !== false && !(h.object.material.blending === THREE.AdditiveBlending));
  if (!hit) return;
  const dir = camera.position.clone().sub(hit.point).normalize();
  flyTo(hit.point.clone().add(dir.multiplyScalar(2.2)), hit.point, 1.2);
});

// blade roll: hovering a name lights its sword; choosing it does the same as a click
document.querySelectorAll("#blade-roll a").forEach((a) => {
  const sw = swords[Number(a.dataset.index)];
  a.addEventListener("mouseenter", () => { pointerDriven = false; setHovered(sw); });
  a.addEventListener("focus", () => { pointerDriven = false; setHovered(sw); });
  a.addEventListener("mouseleave", () => setHovered(null));
  a.addEventListener("click", (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    choose(sw);
  });
});

// restore state if the page is revived from the back/forward cache
window.addEventListener("pageshow", (e) => {
  if (!e.persisted) return;
  chosen = null;
  document.body.classList.remove("is-chosen");
  swords.forEach((s) => { s.target = 0.35; s.liftTarget = 0; });
  setHovered(null);
  flyTo(HOME.pos, HOME.target, 0.01);
});

/* ------------------------------------------------------------ render loop */
const clock = new THREE.Clock();
const bounds = { x: HALF - 0.6, z: HALF - 0.6, yMin: 0.35, yMax: HEIGHT - 1.2 };

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  if (flight) {
    flight.t += dt / flight.duration;
    const k = ease(Math.min(1, flight.t));
    camera.position.lerpVectors(flight.fromPos, flight.pos, k);
    controls.target.lerpVectors(flight.fromTarget, flight.target, k);
    if (flight.t >= 1) flight = null;
  }
  controls.update();
  // stay inside the hall
  camera.position.x = THREE.MathUtils.clamp(camera.position.x, -bounds.x, bounds.x);
  camera.position.z = THREE.MathUtils.clamp(camera.position.z, -bounds.z, bounds.z);
  camera.position.y = THREE.MathUtils.clamp(camera.position.y, bounds.yMin, bounds.yMax);

  flames.forEach((m) => (m.uniforms.uTime.value = t));
  animated.forEach((fn) => fn(t, dt));
  let moving = false;
  swords.forEach((s) => { if (updateSword(s, t, dt, camera)) moving = true; });
  if (moving) renderer.shadowMap.needsUpdate = true;

  const active = chosen || hovered;
  const want = active ? (chosen ? 9 : 2.5) : 0;
  hoverLight.intensity += (want - hoverLight.intensity) * Math.min(1, dt * 5);

  composer.render(dt);
  requestAnimationFrame(frame);
}

// deep links: ?view=above|hearth|window|armour, and ?cam=x,y,z,tx,ty,tz for exact framing
const params = new URLSearchParams(location.search);
if (VIEWS[params.get("view")]) {
  const [p, t] = VIEWS[params.get("view")]();
  camera.position.copy(p); controls.target.copy(t);
}
if (params.get("cam")) {
  const v = params.get("cam").split(",").map(Number);
  if (v.length === 6 && v.every(Number.isFinite)) { camera.position.set(v[0], v[1], v[2]); controls.target.set(v[3], v[4], v[5]); }
}
// ?blade=<index> presents one sword, drawn from the table
if (swords[Number(params.get("blade"))]) setHovered(swords[Number(params.get("blade"))]);

ui.loader.classList.add("is-done");
setTimeout(() => ui.loader.remove(), 1200);
setTimeout(() => ui.hint.classList.add("is-faded"), 9000);
frame();
