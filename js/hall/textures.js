/*
 * Procedurally painted textures for the hall. Everything is drawn onto
 * canvases at load time, so the site ships no image files for the 3D scene.
 */
import * as THREE from "three";
import { rng, makeCanvas, canvasTexture, speckle, woodGrain, TAU } from "./util.js";

/** Castle wall: irregular ashlar blocks. Returns { map, bump }. */
export function stoneWall(seed = 3) {
  const S = 1024;
  const [c, ctx] = makeCanvas(S);
  const [b, bx] = makeCanvas(S);
  const rand = rng(seed);
  ctx.fillStyle = "#1a1715";
  ctx.fillRect(0, 0, S, S);
  bx.fillStyle = "#000";
  bx.fillRect(0, 0, S, S);
  const rowH = 128;
  for (let y = 0; y < S; y += rowH) {
    let x = -rand() * 200;
    while (x < S) {
      const w = 150 + rand() * 170;
      const tone = 58 + rand() * 34;
      const warm = rand() * 8;
      for (const dx of [0, -S, S]) {
        const X = x + dx + 5, Y = y + 5, W = w - 10, H = rowH - 10;
        if (X > S || X + W < 0) continue;
        ctx.fillStyle = `rgb(${tone + warm},${tone + warm * 0.5},${tone - 3})`;
        ctx.beginPath();
        ctx.roundRect(X, Y, W, H, 10 + rand() * 10);
        ctx.fill();
        // bevel shading
        const g = ctx.createLinearGradient(X, Y, X, Y + H);
        g.addColorStop(0, "rgba(255,240,220,.10)");
        g.addColorStop(0.2, "rgba(0,0,0,0)");
        g.addColorStop(1, "rgba(0,0,0,.35)");
        ctx.fillStyle = g;
        ctx.fill();
        const bg = bx.createRadialGradient(X + W / 2, Y + H / 2, 4, X + W / 2, Y + H / 2, Math.max(W, H) * 0.62);
        bg.addColorStop(0, "#d8d8d8");
        bg.addColorStop(0.7, "#aaa");
        bg.addColorStop(1, "#555");
        bx.fillStyle = bg;
        bx.beginPath();
        bx.roundRect(X, Y, W, H, 12);
        bx.fill();
      }
      x += w;
    }
  }
  speckle(ctx, S, S, 60000, 0.22, rand, ["#000", "#8a8278", "#2a2420"]);
  speckle(bx, S, S, 40000, 0.35, rand, ["#000", "#fff"]);
  // cracks and grime streaks
  for (let i = 0; i < 26; i++) {
    let px = rand() * S, py = rand() * S;
    ctx.strokeStyle = "rgba(10,8,6,.6)";
    bx.strokeStyle = "rgba(0,0,0,.8)";
    ctx.lineWidth = bx.lineWidth = 1 + rand() * 1.5;
    ctx.beginPath(); bx.beginPath();
    ctx.moveTo(px, py); bx.moveTo(px, py);
    for (let k = 0; k < 5; k++) {
      px += (rand() - 0.5) * 40; py += 8 + rand() * 22;
      ctx.lineTo(px, py); bx.lineTo(px, py);
    }
    ctx.stroke(); bx.stroke();
  }
  for (let i = 0; i < 18; i++) {
    const x = rand() * S, y = rand() * S * 0.6;
    const g = ctx.createLinearGradient(x, y, x, y + 300);
    g.addColorStop(0, "rgba(20,16,12,.25)");
    g.addColorStop(1, "rgba(20,16,12,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 12, y, 24 + rand() * 30, 300);
  }
  return { map: canvasTexture(c), bump: canvasTexture(b, { color: false }) };
}

/** Flagstone floor. Returns { map, bump, rough }. */
export function flagstones(seed = 9) {
  const S = 1024;
  const [c, ctx] = makeCanvas(S);
  const [b, bx] = makeCanvas(S);
  const rand = rng(seed);
  ctx.fillStyle = "#141210";
  ctx.fillRect(0, 0, S, S);
  bx.fillStyle = "#000";
  bx.fillRect(0, 0, S, S);
  const cell = S / 4;
  for (let gy = 0; gy < 4; gy++) {
    for (let gx = 0; gx < 4; gx++) {
      // occasionally split a cell into two slabs
      const parts = rand() < 0.35 ? [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]] : rand() < 0.3 ? [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]] : [[0, 0, 1, 1]];
      for (const [px, py, pw, ph] of parts) {
        const X = gx * cell + px * cell + 6, Y = gy * cell + py * cell + 6;
        const W = pw * cell - 12, H = ph * cell - 12;
        const t = 50 + rand() * 30;
        ctx.fillStyle = `rgb(${t + 4},${t + 1},${t - 4})`;
        ctx.beginPath(); ctx.roundRect(X, Y, W, H, 8); ctx.fill();
        const g = ctx.createRadialGradient(X + W * 0.3, Y + H * 0.3, 10, X + W / 2, Y + H / 2, Math.max(W, H));
        g.addColorStop(0, "rgba(255,245,230,.07)");
        g.addColorStop(1, "rgba(0,0,0,.3)");
        ctx.fillStyle = g; ctx.fill();
        bx.fillStyle = "#bbb";
        bx.beginPath(); bx.roundRect(X, Y, W, H, 8); bx.fill();
      }
    }
  }
  speckle(ctx, S, S, 70000, 0.2, rand, ["#000", "#7c746a", "#3a3028"]);
  speckle(bx, S, S, 50000, 0.3, rand, ["#000", "#fff"]);
  const rough = canvasTexture(b, { color: false });
  return { map: canvasTexture(c), bump: canvasTexture(b, { color: false }), rough };
}

/** Dark oak for beams, panelling and furniture. */
export function darkWood(seed = 5, { base = "#3a2414", w = 512, h = 512 } = {}) {
  const [c, ctx] = makeCanvas(w, h);
  const rand = rng(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  woodGrain(ctx, 0, 0, w, h, rand, { density: 1.4 });
  speckle(ctx, w, h, 8000, 0.12, rand);
  return canvasTexture(c);
}

/** Bark with glowing embers for the fireplace logs. Returns { map, emissive }. */
export function emberLog(seed = 21) {
  const [c, ctx] = makeCanvas(512, 256);
  const [e, ex] = makeCanvas(512, 256);
  const rand = rng(seed);
  ctx.fillStyle = "#1e140c";
  ctx.fillRect(0, 0, 512, 256);
  ex.fillStyle = "#000";
  ex.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 180; i++) {
    const x = rand() * 512, y = rand() * 256, w = 20 + rand() * 60, h = 3 + rand() * 8;
    ctx.fillStyle = rand() < 0.5 ? "#0c0806" : "#3a2616";
    ctx.fillRect(x, y, w, h);
    if (rand() < 0.35) {
      ex.fillStyle = `rgb(${200 + rand() * 55},${60 + rand() * 80},${10})`;
      ex.fillRect(x + 2, y + 1, w * 0.7, Math.max(1, h * 0.4));
    }
  }
  return { map: canvasTexture(c), emissive: canvasTexture(e) };
}

/** The great rug beneath the table: crimson field, gold and navy borders. */
export function rug(seed = 13) {
  const W = 1024, H = 1024;
  const [c, ctx] = makeCanvas(W, H);
  const rand = rng(seed);
  ctx.fillStyle = "#4a0a12";
  ctx.fillRect(0, 0, W, H);
  const border = (inset, width, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
  };
  ctx.fillStyle = "#14183a";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#5a0c16";
  ctx.fillRect(70, 70, W - 140, H - 140);
  border(40, 10, "#c9a13b");
  border(70, 4, "#c9a13b");
  border(96, 3, "#8a6a22");
  // repeating lozenges in the navy border
  ctx.fillStyle = "#c9a13b";
  for (let i = 0; i < 24; i++) {
    const t = (i + 0.5) / 24;
    for (const [x, y] of [[t * W, 55], [t * W, H - 55], [55, t * H], [W - 55, t * H]]) {
      ctx.beginPath();
      ctx.moveTo(x, y - 9); ctx.lineTo(x + 9, y); ctx.lineTo(x, y + 9); ctx.lineTo(x - 9, y); ctx.fill();
    }
  }
  // damask field
  ctx.globalAlpha = 0.28;
  for (let y = 140; y < H - 120; y += 90) {
    for (let x = 140 + ((y / 90) % 2) * 45; x < W - 120; x += 90) {
      ctx.fillStyle = "#b8323f";
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * TAU;
        ctx.ellipse(x + Math.cos(a) * 12, y + Math.sin(a) * 12, 12, 5, a, 0, TAU);
      }
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  // central medallion ring
  ctx.strokeStyle = "#c9a13b";
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(W / 2, H / 2, 330, 0, TAU); ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(W / 2, H / 2, 350, 0, TAU); ctx.stroke();
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * TAU;
    ctx.save();
    ctx.translate(W / 2 + Math.cos(a) * 340, H / 2 + Math.sin(a) * 340);
    ctx.rotate(a);
    ctx.fillStyle = "#c9a13b";
    ctx.beginPath(); ctx.ellipse(0, 0, 10, 4, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // wear
  speckle(ctx, W, H, 90000, 0.18, rand, ["#000", "#2a0508", "#d8b060"]);
  return canvasTexture(c, { wrap: false });
}

/** Royal banner cloth: crimson with gold trim, crown and crossed swords. */
export function bannerCloth(seed = 31, variant = 0) {
  const W = 512, H = 1280;
  const [c, ctx] = makeCanvas(W, H);
  const rand = rng(seed);
  // swallowtail outline
  const outline = () => {
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H); ctx.lineTo(W / 2, H - 180); ctx.lineTo(0, H); ctx.closePath();
  };
  outline();
  ctx.save();
  ctx.clip();
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, "#4a0710"); g.addColorStop(0.2, "#8a1020"); g.addColorStop(0.5, "#a3142c");
  g.addColorStop(0.8, "#8a1020"); g.addColorStop(1, "#4a0710");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // damask
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#ff5a6a";
  for (let y = 40; y < H; y += 70) {
    for (let x = 30 + ((y / 70) % 2) * 35; x < W; x += 70) {
      ctx.beginPath();
      ctx.moveTo(x, y - 14); ctx.quadraticCurveTo(x + 10, y, x, y + 14); ctx.quadraticCurveTo(x - 10, y, x, y - 14);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  // gold borders following the outline
  const gold = ctx.createLinearGradient(0, 0, W, H);
  gold.addColorStop(0, "#f6df9a"); gold.addColorStop(0.35, "#b8892e"); gold.addColorStop(0.6, "#f0cf6e"); gold.addColorStop(1, "#8a6418");
  ctx.strokeStyle = gold;
  for (const [inset, lw] of [[26, 14], [52, 4]]) {
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(inset, inset); ctx.lineTo(W - inset, inset); ctx.lineTo(W - inset, H - inset * 2.2);
    ctx.lineTo(W / 2, H - 180 - inset * 1.2); ctx.lineTo(inset, H - inset * 2.2); ctx.closePath();
    ctx.stroke();
  }
  // emblem
  ctx.save();
  ctx.translate(W / 2, 560);
  ctx.fillStyle = gold;
  ctx.strokeStyle = "#3a0508";
  ctx.lineWidth = 3;
  // shield
  ctx.beginPath();
  ctx.moveTo(-120, -150); ctx.lineTo(120, -150); ctx.lineTo(120, 20);
  ctx.quadraticCurveTo(120, 140, 0, 200); ctx.quadraticCurveTo(-120, 140, -120, 20); ctx.closePath();
  ctx.fillStyle = "#2a0610"; ctx.fill();
  ctx.lineWidth = 12; ctx.strokeStyle = gold; ctx.stroke();
  ctx.fillStyle = gold;
  if (variant === 0) {
    // crossed swords
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.rotate(s * 0.62);
      ctx.fillRect(-7, -165, 14, 250);
      ctx.beginPath(); ctx.moveTo(-7, -165); ctx.lineTo(0, -195); ctx.lineTo(7, -165); ctx.fill();
      ctx.fillRect(-40, 85, 80, 14);
      ctx.fillRect(-6, 99, 12, 44);
      ctx.beginPath(); ctx.arc(0, 152, 12, 0, TAU); ctx.fill();
      ctx.restore();
    }
  } else {
    // rampant lion silhouette, simplified heraldic form
    ctx.beginPath();
    ctx.moveTo(-30, 150); ctx.lineTo(-10, 60); ctx.lineTo(-60, 30); ctx.lineTo(-50, -10); ctx.lineTo(-20, 0);
    ctx.lineTo(-40, -60); ctx.lineTo(-10, -110); ctx.lineTo(30, -115); ctx.lineTo(55, -90); ctx.lineTo(40, -70);
    ctx.lineTo(60, -40); ctx.lineTo(30, -35); ctx.lineTo(45, 10); ctx.lineTo(80, 30); ctx.lineTo(60, 60);
    ctx.lineTo(25, 50); ctx.lineTo(40, 150); ctx.lineTo(15, 150); ctx.lineTo(5, 90); ctx.lineTo(-10, 150); ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = gold;
    ctx.beginPath(); ctx.moveTo(-30, 60); ctx.bezierCurveTo(-100, 40, -90, -40, -60, -60); ctx.stroke();
  }
  // crown
  ctx.fillStyle = gold;
  ctx.translate(0, -250);
  ctx.beginPath();
  ctx.moveTo(-90, 40); ctx.lineTo(-100, -30); ctx.lineTo(-50, 5); ctx.lineTo(0, -50); ctx.lineTo(50, 5); ctx.lineTo(100, -30); ctx.lineTo(90, 40);
  ctx.closePath(); ctx.fill();
  ctx.fillRect(-92, 40, 184, 22);
  for (const [x, y, r] of [[-100, -36, 10], [0, -58, 12], [100, -36, 10]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
  ctx.fillStyle = "#1a3a8a"; ctx.beginPath(); ctx.arc(0, 51, 8, 0, TAU); ctx.fill();
  ctx.fillStyle = "#b8142c"; ctx.beginPath(); ctx.arc(-50, 51, 6, 0, TAU); ctx.arc(50, 51, 6, 0, TAU); ctx.fill();
  ctx.restore();
  // fleur-de-lis row near top
  ctx.fillStyle = gold;
  for (let i = 0; i < 3; i++) {
    const x = W * (0.25 + i * 0.25), y = 130;
    ctx.beginPath();
    ctx.moveTo(x, y - 34); ctx.quadraticCurveTo(x + 14, y - 10, x, y + 14); ctx.quadraticCurveTo(x - 14, y - 10, x, y - 34);
    ctx.moveTo(x - 4, y); ctx.quadraticCurveTo(x - 34, y - 26, x - 26, y + 6); ctx.quadraticCurveTo(x - 16, y + 12, x - 4, y + 8);
    ctx.moveTo(x + 4, y); ctx.quadraticCurveTo(x + 34, y - 26, x + 26, y + 6); ctx.quadraticCurveTo(x + 16, y + 12, x + 4, y + 8);
    ctx.fill();
    ctx.fillRect(x - 16, y + 12, 32, 6);
  }
  speckle(ctx, W, H, 30000, 0.12, rand, ["#000", "#ff8a8a"]);
  ctx.restore();
  const t = canvasTexture(c, { wrap: false });
  return t;
}

/** Window-pane pattern projected by the moonlight (white = light passes). */
export function windowCookie() {
  const S = 512;
  const [c, ctx] = makeCanvas(S);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, S, S);
  const cx = S / 2, top = 70, bot = 460, half = 110;
  const g = ctx.createRadialGradient(cx, S / 2, 20, cx, S / 2, 260);
  g.addColorStop(0, "#fff"); g.addColorStop(1, "#8899aa");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx - half, bot); ctx.lineTo(cx - half, top + 110);
  ctx.quadraticCurveTo(cx - half, top, cx, top - 30);
  ctx.quadraticCurveTo(cx + half, top, cx + half, top + 110);
  ctx.lineTo(cx + half, bot); ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 9;
  ctx.beginPath(); ctx.moveTo(cx, top - 30); ctx.lineTo(cx, bot); ctx.stroke();
  ctx.lineWidth = 4;
  for (let y = top + 60; y < bot; y += 56) { ctx.beginPath(); ctx.moveTo(cx - half, y); ctx.lineTo(cx + half, y); ctx.stroke(); }
  // soften edges (blur via downscale trick)
  const [d, dx] = makeCanvas(S);
  dx.filter = "blur(4px)";
  dx.drawImage(c, 0, 0);
  const t = new THREE.CanvasTexture(d);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Clock dial for the Time sword. */
export function clockDial() {
  const S = 256;
  const [c, ctx] = makeCanvas(S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 10, S / 2, S / 2, S / 2);
  g.addColorStop(0, "#fffaf0"); g.addColorStop(0.85, "#efe0b8"); g.addColorStop(1, "#b8923e");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2, 0, TAU); ctx.fill();
  ctx.fillStyle = "#3a2a0c";
  ctx.font = "700 26px Cinzel, serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ["XII", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI"].forEach((n, i) => {
    const a = (i / 12) * TAU - Math.PI / 2;
    ctx.save();
    ctx.translate(S / 2 + Math.cos(a) * 96, S / 2 + Math.sin(a) * 96);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillText(n, 0, 0);
    ctx.restore();
  });
  ctx.strokeStyle = "#3a2a0c";
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * TAU;
    ctx.lineWidth = i % 5 ? 1 : 3;
    ctx.beginPath();
    ctx.moveTo(S / 2 + Math.cos(a) * 118, S / 2 + Math.sin(a) * 118);
    ctx.lineTo(S / 2 + Math.cos(a) * (i % 5 ? 112 : 106), S / 2 + Math.sin(a) * (i % 5 ? 112 : 106));
    ctx.stroke();
  }
  return canvasTexture(c, { wrap: false });
}
