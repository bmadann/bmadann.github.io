/*
 * The nine elemental blades, drawn as SVG.
 *
 * Every sword is drawn in its own local space: the tip sits at (0, 0) and the
 * sword runs down the +y axis to the pommel at about y = 238. Callers
 * translate/rotate the returned group into place.
 *
 *   0 ─ tip
 *   150 ─ blade base / crossguard
 *   164–210 ─ grip
 *   222 ─ pommel
 */

const SWORD_LENGTH = 238;

/* Blade gradient stops (edge → ridge → edge) and fittings palette per element. */
const PALETTES = {
  fire:      { blade: ["#4a0a02", "#e0431a", "#ffe9a8", "#ff8a1f", "#5a0d02"], metal: ["#1f1512", "#4a2c22", "#8a5238"], gem: ["#fff3b0", "#ff7a1a", "#8a1400"], grip: "#5b1a10" },
  water:     { blade: ["#052c40", "#1b82b0", "#e4fbff", "#3fb6d9", "#073a52"], metal: ["#0d2f45", "#2d6f94", "#9fd7ef"], gem: ["#ffffff", "#9eeaff", "#1a6f9c"], grip: "#123d5c" },
  wind:      { blade: ["#5e6d78", "#b9ccd6", "#ffffff", "#dfe9ef", "#6f7f8c"], metal: ["#6d7b86", "#b7c6d0", "#f4fbff"], gem: ["#ffffff", "#dff6ff", "#8fb7cc"], grip: "#d9e3ea" },
  wood:      { blade: ["#2e1b0b", "#6f4520", "#d7ab6c", "#8a5a2b", "#3b2410"], metal: ["#2b1a0c", "#5e3b1b", "#94683a"], gem: ["#eaffd0", "#6fd14a", "#1f5c12"], grip: "#3d2a14" },
  earth:     { blade: ["#2d2014", "#6d5236", "#d4b385", "#8c6a44", "#3a2b1c"], metal: ["#2a2420", "#5a4e44", "#9a8b7a"], gem: ["#fff0c2", "#e8a23c", "#7a4108"], grip: "#4a3524" },
  space:     { blade: ["#07041a", "#23155a", "#b9a8ff", "#3a2a7a", "#0b0620"], metal: ["#120c2e", "#3b2f73", "#a99bea"], gem: ["#ffffff", "#c9b8ff", "#3a1f9e"], grip: "#1a1238" },
  machinery: { blade: ["#24262a", "#6a727c", "#e9edf1", "#8c949e", "#2d2f33"], metal: ["#3b2a12", "#9a6a22", "#f0c46a"], gem: ["#fff4d6", "#ffb940", "#8a4a00"], grip: "#2b2d31" },
  glass:     { blade: ["rgba(150,215,240,.35)", "rgba(210,245,255,.25)", "rgba(255,255,255,.9)", "rgba(190,235,250,.3)", "rgba(120,190,220,.45)"], metal: ["rgba(120,190,220,.55)", "rgba(200,240,255,.6)", "rgba(255,255,255,.95)"], gem: ["#ffffff", "#d9fbff", "#6ec7e0"], grip: "rgba(170,225,245,.5)" },
  time:      { blade: ["#3a2a0c", "#8a6a2a", "#fff0b8", "#b8923e", "#4a3712"], metal: ["#3a2a0c", "#9c7a2c", "#f7dc8a"], gem: ["#fffbe8", "#f5d67a", "#8a6a12"], grip: "#2b1f3a" },
};

/* ----------------------------------------------------------------- helpers */

const f1 = (n) => Math.round(n * 10) / 10;

/** Gear outline centred on (cx, cy). */
function gearPath(cx, cy, rOut, rIn, teeth) {
  const pts = [];
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const q = step / 4;
    pts.push([a - q * 1.1, rIn], [a - q * 0.6, rOut], [a + q * 0.6, rOut], [a + q * 1.1, rIn]);
  }
  return "M" + pts.map(([a, r]) => `${f1(cx + r * Math.sin(a))},${f1(cy - r * Math.cos(a))}`).join(" L") + " Z";
}

/** Symmetric blade outline from a list of [halfWidth, y] points on the right edge. */
function mirrorPath(right) {
  const r = right.map(([x, y]) => `${f1(x)},${f1(y)}`);
  const l = right.slice().reverse().map(([x, y]) => `${f1(-x)},${f1(y)}`);
  return `M0,0 L${r.join(" L")} L${l.join(" L")} Z`;
}

/** Classic tapered blade: point, then straight edges to the base. */
function classicBlade(w, len = 150, shoulder = 44) {
  return `M0,0 C${f1(w * 0.35)},8 ${f1(w * 0.8)},${f1(shoulder / 2)} ${w},${shoulder} L${w},${len} L${-w},${len} L${-w},${shoulder} C${f1(-w * 0.8)},${f1(shoulder / 2)} ${f1(-w * 0.35)},8 0,0 Z`;
}

/** Four-pointed sparkle. */
function sparkle(cx, cy, r) {
  const s = r * 0.22;
  return `M${cx},${cy - r} L${cx + s},${cy - s} L${cx + r},${cy} L${cx + s},${cy + s} L${cx},${cy + r} L${cx - s},${cy + s} L${cx - r},${cy} L${cx - s},${cy - s} Z`;
}

/** Standard grip with diagonal wrap bands. */
function wrappedGrip(id, fill, bandColor, y0 = 162, y1 = 210, hw = 5) {
  let bands = "";
  for (let y = y0 + 3; y < y1 - 2; y += 6) {
    bands += `<path d="M${-hw},${y + 3} L${hw},${y}" stroke="${bandColor}" stroke-width="1.6" opacity=".55"/>`;
  }
  return `<rect x="${-hw}" y="${y0}" width="${hw * 2}" height="${y1 - y0}" rx="3" fill="${fill}"/>
    <rect x="${-hw}" y="${y0}" width="${hw * 2}" height="${y1 - y0}" rx="3" fill="url(#${id}-gripshade)"/>
    ${bands}`;
}

/* ------------------------------------------------------------ definitions */

function swordDefs(el, id) {
  const p = PALETTES[el];
  const [b0, b1, b2, b3, b4] = p.blade;
  const [m0, m1, m2] = p.metal;
  const [g0, g1, g2] = p.gem;
  const glow = ELEMENTS[el].glow;
  return `
  <linearGradient id="${id}-blade" x1="0" x2="1" y1="0" y2="0">
    <stop offset="0" stop-color="${b0}"/><stop offset=".36" stop-color="${b1}"/>
    <stop offset=".5" stop-color="${b2}"/><stop offset=".62" stop-color="${b3}"/>
    <stop offset="1" stop-color="${b4}"/>
  </linearGradient>
  <linearGradient id="${id}-tipshine" x1="0" x2="0" y1="0" y2="1">
    <stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/>
    <stop offset=".85" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/>
  </linearGradient>
  <linearGradient id="${id}-metal" x1="0" x2="0" y1="0" y2="1">
    <stop offset="0" stop-color="${m2}"/><stop offset=".45" stop-color="${m1}"/><stop offset="1" stop-color="${m0}"/>
  </linearGradient>
  <linearGradient id="${id}-metalh" x1="0" x2="1" y1="0" y2="0">
    <stop offset="0" stop-color="${m0}"/><stop offset=".5" stop-color="${m2}"/><stop offset="1" stop-color="${m0}"/>
  </linearGradient>
  <linearGradient id="${id}-gripshade" x1="0" x2="1" y1="0" y2="0">
    <stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset=".4" stop-color="#fff" stop-opacity=".18"/>
    <stop offset="1" stop-color="#000" stop-opacity=".5"/>
  </linearGradient>
  <radialGradient id="${id}-gem" cx=".38" cy=".35" r=".7">
    <stop offset="0" stop-color="${g0}"/><stop offset=".45" stop-color="${g1}"/><stop offset="1" stop-color="${g2}"/>
  </radialGradient>
  <radialGradient id="${id}-aura" cx=".5" cy=".5" r=".5">
    <stop offset="0" stop-color="${glow}" stop-opacity=".9"/><stop offset=".55" stop-color="${glow}" stop-opacity=".28"/>
    <stop offset="1" stop-color="${glow}" stop-opacity="0"/>
  </radialGradient>
  <filter id="${id}-glow" x="-80%" y="-20%" width="260%" height="140%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="b"/>
    <feFlood flood-color="${glow}"/>
    <feComposite in2="b" operator="in" result="g"/>
    <feMerge><feMergeNode in="g"/><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  ${EXTRA_DEFS[el] ? EXTRA_DEFS[el](id) : ""}`;
}

const EXTRA_DEFS = {
  fire: (id) => `
  <linearGradient id="${id}-flame" x1="0" x2="0" y1="1" y2="0">
    <stop offset="0" stop-color="#ffdf6b" stop-opacity=".95"/><stop offset=".5" stop-color="#ff6a1a" stop-opacity=".75"/>
    <stop offset="1" stop-color="#b3200a" stop-opacity="0"/>
  </linearGradient>`,
  space: (id) => `
  <radialGradient id="${id}-nebula" cx=".5" cy=".3" r=".7">
    <stop offset="0" stop-color="#d27bff" stop-opacity=".55"/><stop offset=".5" stop-color="#4b2fbf" stop-opacity=".25"/>
    <stop offset="1" stop-color="#000" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="${id}-planet" x1="0" x2="1" y1="0" y2="1">
    <stop offset="0" stop-color="#f2c9ff"/><stop offset=".5" stop-color="#8a5cf0"/><stop offset="1" stop-color="#2a1470"/>
  </linearGradient>`,
  glass: (id) => `
  <linearGradient id="${id}-prism" x1="0" x2="1" y1="0" y2="1">
    <stop offset="0" stop-color="#ff7a7a" stop-opacity="0"/><stop offset=".3" stop-color="#ffd36b" stop-opacity=".55"/>
    <stop offset=".45" stop-color="#7dffb0" stop-opacity=".55"/><stop offset=".6" stop-color="#6bc8ff" stop-opacity=".55"/>
    <stop offset=".75" stop-color="#c38bff" stop-opacity=".45"/><stop offset="1" stop-color="#c38bff" stop-opacity="0"/>
  </linearGradient>`,
  time: (id) => `
  <radialGradient id="${id}-dial" cx=".5" cy=".45" r=".6">
    <stop offset="0" stop-color="#fffaf0"/><stop offset=".8" stop-color="#efe0b8"/><stop offset="1" stop-color="#b8923e"/>
  </radialGradient>`,
  wood: (id) => `
  <linearGradient id="${id}-leaf" x1="0" x2="1" y1="0" y2="1">
    <stop offset="0" stop-color="#b9f27a"/><stop offset=".6" stop-color="#4fa233"/><stop offset="1" stop-color="#23601a"/>
  </linearGradient>`,
  earth: (id) => `
  <linearGradient id="${id}-rock" x1="0" x2="1" y1="0" y2="1">
    <stop offset="0" stop-color="#a8998a"/><stop offset=".5" stop-color="#6b5e52"/><stop offset="1" stop-color="#352d27"/>
  </linearGradient>`,
};

/* -------------------------------------------------------------- the blades */

const BLADES = {
  fire(id) {
    // Flamberge: a wavy, flame-like edge.
    const right = [];
    for (let y = 4; y <= 150; y += 3) {
      const base = y < 40 ? 12 * Math.sin((y / 40) * Math.PI / 2) : 12;
      right.push([base + (y > 20 ? 2.4 * Math.sin(y / 7) : 0), y]);
    }
    const blade = mirrorPath(right);
    let flames = "";
    [[-15, 60, 0], [15, 88, 0.4], [-15, 118, 0.8], [15, 132, 1.2], [-14, 34, 1.6]].forEach(([x, y, d]) => {
      const s = x < 0 ? -1 : 1;
      flames += `<path class="fx-flicker" style="animation-delay:-${d}s" d="M${x},${y + 14} C${x + s * 7},${y + 6} ${x + s * 2},${y - 4} ${x + s * 6},${y - 18} C${x - s * 3},${y - 8} ${x - s * 6},${y + 2} ${x},${y + 14} Z" fill="url(#${id}-flame)"/>`;
    });
    let embers = "";
    for (let i = 0; i < 7; i++) {
      embers += `<circle class="fx-rise" style="animation-delay:-${(i * 0.53).toFixed(2)}s;animation-duration:${(2.6 + (i % 3) * 0.6).toFixed(1)}s" cx="${[-8, 6, -3, 10, -11, 2, 7][i]}" cy="${140 - i * 6}" r="${[1.6, 1.1, 1.4, 0.9, 1.2, 1.7, 1][i]}" fill="${i % 2 ? "#ffd36b" : "#ff7a1a"}"/>`;
    }
    return `
      ${flames}
      <path d="${blade}" fill="url(#${id}-blade)" stroke="#3a0800" stroke-width=".8"/>
      <path d="M0,8 L0,146" stroke="#fff6d0" stroke-width="1.2" opacity=".75"/>
      <path d="M0,40 Q-3,70 0,95 Q3,120 0,146" stroke="#ff3d00" stroke-width="2.2" fill="none" opacity=".55" class="fx-pulse"/>
      <path d="${blade}" fill="url(#${id}-tipshine)"/>
      ${embers}`;
  },

  water(id) {
    const blade = classicBlade(11);
    let bubbles = "";
    for (let i = 0; i < 6; i++) {
      bubbles += `<circle class="fx-rise fx-slow" style="animation-delay:-${(i * 0.7).toFixed(1)}s" cx="${[-5, 4, -2, 6, -7, 1][i]}" cy="${145 - i * 4}" r="${[1.8, 1.2, 2.2, 1, 1.5, 1.3][i]}" fill="none" stroke="#dffaff" stroke-width=".7"/>`;
    }
    return `
      <path d="${blade}" fill="url(#${id}-blade)" stroke="#022033" stroke-width=".8"/>
      <path class="fx-flow" d="M0,14 Q5,24 0,34 T0,54 T0,74 T0,94 T0,114 T0,134 T0,146" fill="none" stroke="#e8fdff" stroke-width="1.3" stroke-dasharray="8 6" opacity=".85"/>
      <path d="M-7,60 Q-4,56 -1,60 T5,60 M-8,90 Q-5,86 -2,90 T4,90 M-7,120 Q-4,116 -1,120 T5,120" fill="none" stroke="#0a4f73" stroke-width=".9" opacity=".7"/>
      <path d="${blade}" fill="url(#${id}-tipshine)"/>
      ${bubbles}`;
  },

  wind(id) {
    const blade = classicBlade(9, 150, 52);
    const swirl = (y, s) => `<path d="M${-4 * s},${y} c${2 * s},-4 ${7 * s},-3 ${7 * s},1 c0,3 ${-3 * s},4 ${-5 * s},2 c${-1 * s},-1 0,-3 ${1.5 * s},-2.5" fill="none" stroke="#6f8796" stroke-width=".9"/>`;
    let wisps = "";
    [[26, 0], [74, 1.1], [118, 2.2]].forEach(([y, d]) => {
      wisps += `<path class="fx-wisp" style="animation-delay:-${d}s" d="M-22,${y + 10} C-10,${y} 10,${y + 18} 22,${y + 4}" fill="none" stroke="#f2fbff" stroke-width="1.2" stroke-linecap="round"/>`;
    });
    return `
      <path d="${blade}" fill="url(#${id}-blade)" stroke="#51606b" stroke-width=".7"/>
      <path d="M0,8 L0,146" stroke="#fff" stroke-width="1" opacity=".9"/>
      ${swirl(60, 1)}${swirl(92, -1)}${swirl(124, 1)}
      <path d="${blade}" fill="url(#${id}-tipshine)"/>
      ${wisps}`;
  },

  wood(id) {
    const blade = "M0,0 C9,18 16,55 14.5,98 C13.5,122 11.5,138 10.5,150 L-10.5,150 C-11.5,138 -13.5,122 -14.5,98 C-16,55 -9,18 0,0 Z";
    let veins = "";
    for (let y = 30; y < 140; y += 16) {
      veins += `<path d="M0,${y + 6} Q5,${y + 2} 9,${y - 5} M0,${y + 6} Q-5,${y + 2} -9,${y - 5}" fill="none" stroke="#2e1b0b" stroke-width=".8" opacity=".55"/>`;
    }
    let leaves = "";
    for (let i = 0; i < 4; i++) {
      leaves += `<path class="fx-leaf" style="animation-delay:-${(i * 1.1).toFixed(1)}s" d="M0,0 C3,-3 7,-2 8,0 C7,2 3,3 0,0 Z" transform="translate(${[-10, 8, -6, 11][i]} ${[128, 100, 70, 42][i]})" fill="url(#${id}-leaf)"/>`;
    }
    return `
      <path d="${blade}" fill="url(#${id}-blade)" stroke="#1f1206" stroke-width=".8"/>
      <path d="M0,6 L0,146" stroke="#e8c48c" stroke-width="1" opacity=".8"/>
      ${veins}
      <path d="${blade}" fill="none" stroke="#7fd36b" stroke-width="1.4" opacity=".35"/>
      <path d="${blade}" fill="url(#${id}-tipshine)"/>
      ${leaves}`;
  },

  earth(id) {
    const blade = mirrorPath([[4, 6], [9, 18], [12, 30], [15, 44], [14, 58], [15.5, 70], [15, 90], [16, 104], [14.5, 118], [15.5, 132], [15, 150]]);
    let dust = "";
    for (let i = 0; i < 5; i++) {
      dust += `<path class="fx-bob" style="animation-delay:-${(i * 0.8).toFixed(1)}s" d="M0,-2 L2,-1 L1.5,1.5 L-1.5,2 L-2,0 Z" transform="translate(${[-22, 21, -19, 23, -24][i]} ${[130, 108, 84, 62, 40][i]}) scale(${[1.3, 1, 1.5, 0.9, 1.1][i]})" fill="#8c7a66"/>`;
    }
    return `
      <path d="${blade}" fill="url(#${id}-blade)" stroke="#1f160e" stroke-width="1"/>
      <path d="M0,8 L0,146" stroke="#f0dcb8" stroke-width="1.1" opacity=".55"/>
      <path class="fx-pulse" d="M-6,58 L-2,72 L-7,84 L-3,98 M5,104 L2,116 L7,128 L3,140 M4,30 L1,42 L5,50" fill="none" stroke="#ffb347" stroke-width="1.3" stroke-linecap="round"/>
      <path d="${blade}" fill="url(#${id}-tipshine)"/>
      ${dust}`;
  },

  space(id) {
    const blade = classicBlade(11.5);
    const stars = [[-5, 30, 0.9], [4, 44, 0.7], [-2, 62, 1.1], [6, 78, 0.6], [-6, 96, 0.8], [2, 110, 1], [-4, 128, 0.7], [5, 138, 0.9], [0, 20, 0.6]];
    return `
      <path d="${blade}" fill="url(#${id}-blade)" stroke="#05030f" stroke-width=".8"/>
      <path d="${blade}" fill="url(#${id}-nebula)"/>
      ${stars.map(([x, y, r], i) => `<circle class="fx-twinkle" style="animation-delay:-${(i * 0.37).toFixed(2)}s" cx="${x}" cy="${y}" r="${r}" fill="#fff"/>`).join("")}
      <path class="fx-twinkle" style="animation-delay:-.9s" d="${sparkle(-1, 86, 3.5)}" fill="#e9e2ff"/>
      <path d="${blade}" fill="url(#${id}-tipshine)" opacity=".6"/>
      <path class="fx-twinkle" style="animation-delay:-1.4s" d="${sparkle(-20, 60, 3)}" fill="#cfc2ff"/>
      <path class="fx-twinkle" style="animation-delay:-.2s" d="${sparkle(19, 104, 2.5)}" fill="#cfc2ff"/>`;
  },

  machinery(id) {
    const blade = classicBlade(12, 150, 36);
    let plates = "", rivets = "";
    for (let y = 56; y < 150; y += 22) plates += `<path d="M-12,${y} L12,${y}" stroke="#1d1f22" stroke-width="1"/><path d="M-12,${y + 1} L12,${y + 1}" stroke="#fff" stroke-width=".5" opacity=".35"/>`;
    for (let y = 64; y < 150; y += 22) rivets += `<circle cx="-8" cy="${y}" r="1.3" fill="#d9dde2" stroke="#2b2d31" stroke-width=".4"/><circle cx="8" cy="${y}" r="1.3" fill="#d9dde2" stroke="#2b2d31" stroke-width=".4"/>`;
    let sparks = "";
    for (let i = 0; i < 5; i++) {
      const x = [-14, 14, -13, 15, -12][i], y = [128, 96, 70, 44, 110][i], s = x < 0 ? -1 : 1;
      sparks += `<path class="fx-spark" style="animation-delay:-${(i * 0.45).toFixed(2)}s" d="M${x},${y} l${s * 5},-3 M${x},${y} l${s * 6},2" stroke="#ffd36b" stroke-width="1" stroke-linecap="round"/>`;
    }
    return `
      <path d="${blade}" fill="url(#${id}-blade)" stroke="#16181b" stroke-width=".8"/>
      <rect x="-2" y="18" width="4" height="128" rx="1" fill="url(#${id}-metalh)"/>
      ${plates}${rivets}
      <path d="${blade}" fill="url(#${id}-tipshine)"/>
      ${sparks}`;
  },

  glass(id) {
    const blade = classicBlade(11.5);
    let facets = "";
    for (let y = 44; y < 146; y += 17) facets += `<path d="M0,${y} L11.5,${y + 9} M0,${y} L-11.5,${y + 9}" stroke="#fff" stroke-width=".6" opacity=".7"/>`;
    return `
      <path d="${blade}" fill="url(#${id}-blade)" stroke="#fff" stroke-width="1" stroke-opacity=".9"/>
      <path d="M0,4 L0,148" stroke="#fff" stroke-width="1.2"/>
      ${facets}
      <clipPath id="${id}-bclip"><path d="${blade}"/></clipPath>
      <g clip-path="url(#${id}-bclip)"><rect class="fx-sheen" x="-14" y="-40" width="28" height="40" fill="url(#${id}-prism)"/></g>
      <path class="fx-glint" style="animation-delay:-.3s" d="${sparkle(6, 34, 5)}" fill="#fff"/>
      <path class="fx-glint" style="animation-delay:-1.5s" d="${sparkle(-5, 98, 4)}" fill="#fff"/>
      <path class="fx-glint" style="animation-delay:-2.4s" d="${sparkle(16, 124, 3.5)}" fill="#e6fbff"/>`;
  },

  time(id) {
    const blade = classicBlade(11);
    const numerals = ["XII", "III", "VI", "IX"];
    let marks = "";
    numerals.forEach((n, i) => {
      const y = 52 + i * 26;
      marks += `<text x="0" y="${y}" transform="rotate(90 0 ${y})" text-anchor="middle" dominant-baseline="middle" font-family="Cinzel, serif" font-size="7" font-weight="700" fill="#4a3208" opacity=".85">${n}</text>`;
    });
    let sand = "";
    for (let i = 0; i < 6; i++) {
      sand += `<circle class="fx-rise fx-slow" style="animation-delay:-${(i * 0.6).toFixed(1)}s" cx="${[-15, 14, -13, 16, -16, 13][i]}" cy="${140 - i * 5}" r=".9" fill="#ffe8a8"/>`;
    }
    return `
      <path d="${blade}" fill="url(#${id}-blade)" stroke="#2a1d06" stroke-width=".8"/>
      <rect x="-4" y="38" width="8" height="106" rx="3" fill="#e8cf86" opacity=".55"/>
      ${marks}
      <path d="${blade}" fill="url(#${id}-tipshine)"/>
      ${sand}`;
  },
};

/* ------------------------------------------------------------- the guards */

const GUARDS = {
  fire: (id) => `
    <path d="M-42,132 C-38,150 -22,162 0,162 C22,162 38,150 42,132 C36,144 22,152 0,152 C-22,152 -36,144 -42,132 Z" fill="url(#${id}-metal)" stroke="#120a08" stroke-width=".8"/>
    <path d="M-42,132 C-44,124 -40,118 -44,112 C-36,118 -34,126 -38,138 Z M42,132 C44,124 40,118 44,112 C36,118 34,126 38,138 Z" fill="#ff6a1a" opacity=".9" class="fx-flicker"/>
    <circle cx="0" cy="157" r="5.5" fill="url(#${id}-gem)" stroke="#2a0a00" stroke-width=".8" class="fx-pulse"/>`,

  water: (id) => `
    <path d="M-30,152 L30,152 L30,160 L-30,160 Z" fill="url(#${id}-metal)" stroke="#06212f" stroke-width=".8"/>
    <path d="M-28,156 C-36,160 -44,152 -42,144 C-40,136 -30,136 -30,143 C-30,148 -36,148 -36,144" fill="none" stroke="url(#${id}-metalh)" stroke-width="4" stroke-linecap="round"/>
    <path d="M28,156 C36,160 44,152 42,144 C40,136 30,136 30,143 C30,148 36,148 36,144" fill="none" stroke="url(#${id}-metalh)" stroke-width="4" stroke-linecap="round"/>
    <path d="M-20,152 Q-14,146 -8,152 Q-2,146 4,152 Q10,146 16,152" fill="none" stroke="#bff0ff" stroke-width="1" opacity=".8"/>
    <circle cx="0" cy="156" r="4.5" fill="url(#${id}-gem)"/>`,

  wind: (id) => {
    const feather = (s) => `
      <path d="M${s * 6},152 C${s * 20},148 ${s * 36},150 ${s * 48},164 C${s * 36},160 ${s * 22},160 ${s * 6},160 Z" fill="url(#${id}-metal)" stroke="#5f6f7a" stroke-width=".7"/>
      <path d="M${s * 12},156 L${s * 44},162 M${s * 18},152 l${s * 4},6 M${s * 26},152 l${s * 4},7 M${s * 34},154 l${s * 4},7" stroke="#7f919d" stroke-width=".6"/>`;
    return `${feather(-1)}${feather(1)}
      <circle cx="0" cy="156" r="6" fill="url(#${id}-metalh)" stroke="#5f6f7a" stroke-width=".7"/>
      <path d="M-3,156 a3,3 0 1 1 3,3" fill="none" stroke="#5f6f7a" stroke-width="1"/>`;
  },

  wood: (id) => `
    <path d="M-6,150 C-16,150 -26,146 -34,138 C-30,146 -30,152 -36,156 C-26,156 -18,158 -6,162 Z" fill="url(#${id}-metal)" stroke="#1f1206" stroke-width=".8"/>
    <path d="M6,150 C16,150 26,146 34,138 C30,146 30,152 36,156 C26,156 18,158 6,162 Z" fill="url(#${id}-metal)" stroke="#1f1206" stroke-width=".8"/>
    <rect x="-8" y="149" width="16" height="14" rx="4" fill="url(#${id}-metal)" stroke="#1f1206" stroke-width=".8"/>
    <path d="M-34,138 C-37,132 -34,128 -30,128 C-30,132 -32,135 -34,138 Z M34,138 C37,132 34,128 30,128 C30,132 32,135 34,138 Z M-36,156 C-42,156 -44,152 -42,149 C-39,151 -38,153 -36,156 Z M36,156 C42,156 44,152 42,149 C39,151 38,153 36,156 Z" fill="url(#${id}-leaf)"/>
    <circle cx="0" cy="156" r="4" fill="url(#${id}-gem)"/>`,

  earth: (id) => `
    <path d="M-36,148 L-26,146 L26,146 L36,148 L38,160 L26,164 L-26,164 L-38,160 Z" fill="url(#${id}-rock)" stroke="#1f1a16" stroke-width="1"/>
    <path d="M-30,152 L-22,150 M-12,160 L-6,156 L2,160 M18,150 L24,156" stroke="#2a221c" stroke-width=".9" fill="none"/>
    <path d="M-44,150 L-36,144 L-32,152 L-36,162 L-44,160 Z M44,150 L36,144 L32,152 L36,162 L44,160 Z" fill="url(#${id}-rock)" stroke="#1f1a16" stroke-width="1"/>
    <path d="M-4,149 L4,149 L6,156 L0,162 L-6,156 Z" fill="url(#${id}-gem)" stroke="#4a2800" stroke-width=".7" class="fx-pulse"/>`,

  space: (id) => `
    <path d="M-40,140 C-30,160 30,160 40,140 C28,152 -28,152 -40,140 Z" fill="url(#${id}-metalh)" stroke="#07041a" stroke-width=".8"/>
    <rect x="-12" y="150" width="24" height="12" rx="6" fill="url(#${id}-metal)" stroke="#07041a" stroke-width=".8"/>
    <path class="fx-twinkle" d="${sparkle(-40, 140, 4)}" fill="#fff"/>
    <path class="fx-twinkle" style="animation-delay:-1s" d="${sparkle(40, 140, 4)}" fill="#fff"/>
    <circle cx="0" cy="156" r="4" fill="url(#${id}-gem)"/>`,

  machinery: (id) => `
    <rect x="-30" y="151" width="60" height="10" rx="2" fill="url(#${id}-metal)" stroke="#1f1405" stroke-width=".8"/>
    <g class="fx-spin"><path d="${gearPath(-32, 156, 11, 8, 10)}" fill="url(#${id}-metalh)" stroke="#1f1405" stroke-width=".7"/><circle cx="-32" cy="156" r="3" fill="#2b2d31"/></g>
    <g class="fx-spin fx-rev"><path d="${gearPath(32, 156, 11, 8, 10)}" fill="url(#${id}-metalh)" stroke="#1f1405" stroke-width=".7"/><circle cx="32" cy="156" r="3" fill="#2b2d31"/></g>
    <g class="fx-spin fx-rev"><path d="${gearPath(0, 156, 7.5, 5.5, 8)}" fill="url(#${id}-metal)" stroke="#1f1405" stroke-width=".7"/></g>
    <circle cx="0" cy="156" r="2.6" fill="url(#${id}-gem)"/>`,

  glass: (id) => `
    <path d="M-40,156 L-26,148 L-10,152 L-10,160 L-26,164 Z M40,156 L26,148 L10,152 L10,160 L26,164 Z" fill="url(#${id}-metal)" stroke="#fff" stroke-width=".8"/>
    <path d="M-40,156 L-10,156 M-26,148 L-26,164 M40,156 L10,156 M26,148 L26,164" stroke="#fff" stroke-width=".5" opacity=".8"/>
    <path d="M0,146 L10,156 L0,166 L-10,156 Z" fill="url(#${id}-gem)" stroke="#fff" stroke-width=".8"/>
    <path d="M0,146 L0,166 M-10,156 L10,156" stroke="#fff" stroke-width=".5" opacity=".9"/>
    <rect x="-40" y="146" width="80" height="20" fill="url(#${id}-prism)" opacity=".6"/>`,

  time: (id) => {
    let ticks = "";
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      const r1 = i % 3 === 0 ? 8.5 : 9.8;
      ticks += `<path d="M${f1(11.5 * Math.sin(a))},${f1(156 - 11.5 * Math.cos(a))} L${f1(r1 * Math.sin(a))},${f1(156 - r1 * Math.cos(a))}" stroke="#3a2a0c" stroke-width="${i % 3 === 0 ? 1.2 : 0.6}"/>`;
    }
    return `
    <path d="M-40,153 L-14,151 L14,151 L40,153 L40,159 L14,161 L-14,161 L-40,159 Z" fill="url(#${id}-metal)" stroke="#2a1d06" stroke-width=".8"/>
    <path d="M-40,152 C-46,148 -48,160 -40,160 M40,152 C46,148 48,160 40,160" fill="none" stroke="url(#${id}-metalh)" stroke-width="2.5"/>
    <circle cx="-44" cy="156" r="2.4" fill="url(#${id}-gem)"/><circle cx="44" cy="156" r="2.4" fill="url(#${id}-gem)"/>
    <circle cx="0" cy="156" r="14" fill="url(#${id}-metalh)" stroke="#2a1d06" stroke-width=".8"/>
    <circle cx="0" cy="156" r="12" fill="url(#${id}-dial)"/>
    ${ticks}
    <g class="fx-hand-slow"><path d="M0,156 L0,149" stroke="#2a1d06" stroke-width="1.5" stroke-linecap="round"/></g>
    <g class="fx-hand-fast"><path d="M0,156 L0,146" stroke="#8a1a2a" stroke-width=".9" stroke-linecap="round"/></g>
    <circle cx="0" cy="156" r="1.3" fill="#2a1d06"/>`;
  },
};

/* ------------------------------------------------------ grips and pommels */

const HILTS = {
  fire: (id, p) => `${wrappedGrip(id, p.grip, "#ff7a1a")}
    <path d="M0,240 C-12,232 -12,220 -6,212 L6,212 C12,220 12,232 0,240 Z" fill="url(#${id}-metal)" stroke="#120a08" stroke-width=".8"/>
    <circle cx="0" cy="224" r="5.5" fill="url(#${id}-gem)" class="fx-pulse"/>`,

  water: (id, p) => `${wrappedGrip(id, p.grip, "#8fe1ff")}
    <path d="M0,240 C-10,232 -11,220 0,210 C11,220 10,232 0,240 Z" fill="url(#${id}-metal)" stroke="#06212f" stroke-width=".8"/>
    <circle cx="0" cy="225" r="5.5" fill="url(#${id}-gem)"/>
    <circle cx="-1.6" cy="223" r="1.6" fill="#fff" opacity=".9"/>`,

  wind: (id, p) => `${wrappedGrip(id, p.grip, "#8aa3b3", 162, 210, 4.2)}
    <circle cx="0" cy="224" r="10" fill="url(#${id}-metalh)" stroke="#5f6f7a" stroke-width=".8"/>
    <g class="fx-spin fx-slow"><path d="M0,224 C0,218 6,217 7,222 C8,228 0,231 -4,228 C-8,224 -5,216 1,215" fill="none" stroke="#5f6f7a" stroke-width="1.2" stroke-linecap="round"/></g>`,

  wood: (id, p) => `
    <rect x="-5" y="162" width="10" height="48" rx="3" fill="${p.grip}"/>
    <rect x="-5" y="162" width="10" height="48" rx="3" fill="url(#${id}-gripshade)"/>
    <path d="M-5,166 C0,170 5,170 5,174 C0,178 -5,178 -5,182 C0,186 5,186 5,190 C0,194 -5,194 -5,198 C0,202 5,202 5,206" fill="none" stroke="#5aa83a" stroke-width="1.8"/>
    <path d="M5,176 c4,-2 6,0 6,2 c-3,1 -5,0 -6,-2 Z M-5,192 c-4,-2 -6,0 -6,2 c3,1 5,0 6,-2 Z" fill="url(#${id}-leaf)"/>
    <path d="M-9,214 C-9,210 9,210 9,214 L8,218 L-8,218 Z" fill="url(#${id}-metal)" stroke="#1f1206" stroke-width=".7"/>
    <path d="M-8,218 C-8,230 -4,236 0,238 C4,236 8,230 8,218 Z" fill="url(#${id}-gem)" stroke="#1f5c12" stroke-width=".7"/>`,

  earth: (id, p) => `${wrappedGrip(id, p.grip, "#c79a5a", 164, 208, 5.5)}
    <path d="M-12,214 L-4,208 L8,209 L13,218 L10,232 L0,238 L-10,232 Z" fill="url(#${id}-rock)" stroke="#1f1a16" stroke-width="1"/>
    <path d="M-4,208 L-2,218 L-10,232 M-2,218 L13,218 M-2,218 L0,238" stroke="#2a221c" stroke-width=".6" fill="none"/>
    <path d="M1,217 L5,221 L2,228 L-2,224 Z" fill="url(#${id}-gem)" class="fx-pulse"/>`,

  space: (id, p) => `${wrappedGrip(id, p.grip, "#8c7ae0")}
    <circle cx="0" cy="224" r="8" fill="url(#${id}-planet)"/>
    <ellipse cx="0" cy="224" rx="15" ry="4" fill="none" stroke="#d9ccff" stroke-width="1.2" transform="rotate(-20 0 224)"/>
    <path d="M-8,224 A8,8 0 0 0 8,224" fill="url(#${id}-planet)" transform="rotate(-20 0 224)"/>
    <g class="fx-orbit"><circle cx="13" cy="224" r="1.6" fill="#fff"/></g>`,

  machinery: (id) => `
    <rect x="-5" y="162" width="10" height="48" rx="2" fill="url(#${id}-metalh)"/>
    ${[168, 176, 184, 192, 200].map((y) => `<rect x="-6" y="${y}" width="12" height="3" rx="1" fill="url(#${id}-metal)" stroke="#1f1405" stroke-width=".4"/>`).join("")}
    <g class="fx-spin fx-slow"><path d="${gearPath(0, 224, 12, 9, 12)}" fill="url(#${id}-metal)" stroke="#1f1405" stroke-width=".8"/></g>
    <circle cx="0" cy="224" r="5" fill="#2b2d31" stroke="#1f1405" stroke-width=".6"/>
    <path d="M-3,224 L3,224 M0,221 L0,227" stroke="#9aa3ad" stroke-width="1.2"/>`,

  glass: (id, p) => `
    <rect x="-5" y="162" width="10" height="48" rx="3" fill="${p.grip}" stroke="#fff" stroke-width=".7" stroke-opacity=".8"/>
    <path d="M-5,170 L5,176 M-5,180 L5,186 M-5,190 L5,196 M-5,200 L5,206" stroke="#fff" stroke-width=".5" opacity=".6"/>
    <path d="M0,211 L9,217 L9,229 L0,237 L-9,229 L-9,217 Z" fill="url(#${id}-gem)" stroke="#fff" stroke-width=".8"/>
    <path d="M0,211 L0,223 L9,217 M0,223 L-9,217 M0,223 L0,237 M-9,229 L0,223 L9,229" stroke="#fff" stroke-width=".5" fill="none" opacity=".85"/>
    <path d="M0,211 L9,217 L9,229 L0,237 L-9,229 L-9,217 Z" fill="url(#${id}-prism)" opacity=".7"/>`,

  time: (id, p) => `${wrappedGrip(id, p.grip, "#c9a24a")}
    <rect x="-9" y="211" width="18" height="3" rx="1" fill="url(#${id}-metal)"/>
    <rect x="-9" y="235" width="18" height="3" rx="1" fill="url(#${id}-metal)"/>
    <path d="M-7,214 L7,214 L1.2,224.5 L7,235 L-7,235 L-1.2,224.5 Z" fill="rgba(255,250,235,.35)" stroke="url(#${id}-metalh)" stroke-width="1"/>
    <path class="fx-sand-top" d="M-5.2,216 L5.2,216 L0.6,223.5 L-0.6,223.5 Z" fill="#f5d67a"/>
    <path class="fx-sand-bottom" d="M-5.5,234 L5.5,234 L0,226.5 Z" fill="#f5d67a"/>
    <path class="fx-trickle" d="M0,224 L0,233" stroke="#f5d67a" stroke-width=".8" stroke-dasharray="1.5 1.5"/>
    <path d="M-9,212 L-9,237 M9,212 L9,237" stroke="url(#${id}-metalh)" stroke-width="1.6"/>`,
};

/* ------------------------------------------------------------- assemble */

/**
 * Full sword markup (without its <defs>) in local sword space.
 * `id` prefixes the gradient ids produced by swordDefs().
 */
function swordArt(el, id) {
  const p = PALETTES[el];
  return `
    <ellipse class="sword-aura" cx="0" cy="118" rx="42" ry="136" fill="url(#${id}-aura)"/>
    <g class="sword-body" filter="url(#${id}-shadow)">
      ${BLADES[el](id)}
      ${HILTS[el](id, p)}
      ${GUARDS[el](id)}
    </g>`;
}

/** Soft cast shadow so the swords appear to lie on the table. */
function shadowDef(id) {
  return `<filter id="${id}-shadow" x="-60%" y="-10%" width="220%" height="125%">
    <feDropShadow dx="3" dy="5" stdDeviation="3" flood-color="#000" flood-opacity=".55"/>
  </filter>`;
}

/**
 * A standalone <svg> of one sword lying horizontally (tip pointing right),
 * used as the heraldic ornament on content pages.
 */
function swordEmblem(el, id = `emb-${el}`) {
  return `<svg class="sword-emblem" viewBox="-6 -52 250 104" role="img" aria-label="${ELEMENTS[el].label} sword">
    <defs>${swordDefs(el, id)}${shadowDef(id)}</defs>
    <g transform="translate(240 0) rotate(90)">${swordArt(el, id)}</g>
  </svg>`;
}
