/*
 * Builds the Round Table on the home page.
 *
 * Three stacked SVG layers share one 1000×1000 viewBox:
 *   1. the wooden table (static, heavy filters, painted once)
 *   2. the swords (interactive, animated)
 *   3. the centre title plaque
 * Keeping the table in its own layer means sword animations never force the
 * expensive wood filters to repaint.
 */

(function () {
  const C = 500;             // table centre
  const R_TABLE = 452;       // wooden top
  const R_RIM = 484;         // outer edge of the gilded rim
  const R_MEDAL = 182;       // centre medallion
  const R_TIP = 196;         // where sword tips sit
  const STEP = 360 / SWORDS.length;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const root = document.getElementById("round-table");
  const legend = document.getElementById("blade-roll");

  /* ------------------------------------------------------- 1. table layer */

  function plankFilter(i) {
    return `<filter id="wood-${i}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.0035 0.075" numOctaves="4" seed="${i * 7 + 3}" result="t"/>
      <feColorMatrix in="t" type="matrix" values="0 0 0 0 .18  0 0 0 0 .09  0 0 0 0 .04  3.2 0 0 0 -1.35" result="dark"/>
      <feColorMatrix in="t" type="matrix" values="0 0 0 0 .78  0 0 0 0 .52  0 0 0 0 .3  0 2.6 0 0 -1.5" result="light"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.02 0.9" numOctaves="2" seed="${i + 40}" result="fine"/>
      <feColorMatrix in="fine" type="matrix" values="0 0 0 0 .12  0 0 0 0 .06  0 0 0 0 .03  0 0 1.4 0 -.62" result="fineDark"/>
      <feMerge result="m"><feMergeNode in="SourceGraphic"/><feMergeNode in="light"/><feMergeNode in="dark"/><feMergeNode in="fineDark"/></feMerge>
      <feComposite in="m" in2="SourceAlpha" operator="in"/>
    </filter>`;
  }

  function tableLayer() {
    const plankH = 113;
    const tones = ["#6b3f1f", "#74462a", "#633a1c", "#6f4323", "#5f381b", "#704525", "#683e20", "#734829", "#62391d"];
    let planks = "", seams = "", filters = "";
    for (let i = 0, y = 0; y < 1000; i++, y += plankH) {
      filters += plankFilter(i);
      planks += `<rect x="0" y="${y}" width="1000" height="${plankH}" fill="${tones[i % tones.length]}" filter="url(#wood-${i})"/>`;
      if (y > 0) seams += `<path d="M0,${y} H1000" stroke="#1c0e05" stroke-width="3" opacity=".85"/><path d="M0,${y + 2.5} H1000" stroke="#c08a55" stroke-width="1" opacity=".25"/>`;
    }

    // Carved dividers between the seats, like the Winchester table.
    let dividers = "";
    for (let i = 0; i < SWORDS.length; i++) {
      const a = ((i + 0.5) * STEP * Math.PI) / 180;
      const x1 = C + (R_MEDAL + 26) * Math.sin(a), y1 = C - (R_MEDAL + 26) * Math.cos(a);
      const x2 = C + (R_TABLE - 10) * Math.sin(a), y2 = C - (R_TABLE - 10) * Math.cos(a);
      dividers += `<path d="M${x1},${y1} L${x2},${y2}" stroke="#1f1007" stroke-width="2.4" opacity=".7"/>
        <path d="M${x1 + 1.2},${y1 + 1.2} L${x2 + 1.2},${y2 + 1.2}" stroke="#d8a468" stroke-width=".8" opacity=".28"/>
        <circle cx="${x2}" cy="${y2}" r="4" fill="#c9a13b" stroke="#5a4210" stroke-width="1"/>`;
    }

    // Rivets on the rim, in the gaps between the seat engravings.
    let rivets = "";
    const rivetR = (R_TABLE + R_RIM) / 2;
    for (let i = 0; i < SWORDS.length; i++) {
      [[-2.2, 2], [0, 4], [2.2, 2]].forEach(([da, size]) => {
        const a = (((i + 0.5) * STEP + da) * Math.PI) / 180;
        rivets += `<circle cx="${(C + rivetR * Math.sin(a)).toFixed(1)}" cy="${(C - rivetR * Math.cos(a)).toFixed(1)}" r="${size}" fill="url(#rivet)"/>`;
      });
    }

    // Seat names engraved on the rim beneath each sword.
    let engraving = "";
    SWORDS.forEach((s, i) => {
      const a = i * STEP;
      const r = R_TABLE + 16;
      const bottomHalf = a > 90 && a < 270;
      const span = 18;
      const a0 = ((bottomHalf ? a + span : a - span) * Math.PI) / 180;
      const a1 = ((bottomHalf ? a - span : a + span) * Math.PI) / 180;
      const p0 = [C + r * Math.sin(a0), C - r * Math.cos(a0)];
      const p1 = [C + r * Math.sin(a1), C - r * Math.cos(a1)];
      const d = `M${p0[0].toFixed(1)},${p0[1].toFixed(1)} A${r},${r} 0 0 ${bottomHalf ? 0 : 1} ${p1[0].toFixed(1)},${p1[1].toFixed(1)}`;
      const label = `${ELEMENTS[s.element].label} · ${s.title}`.toUpperCase();
      engraving += `<path id="seat-${i}" d="${d}" fill="none"/>
        <text class="rim-text" data-seat="${i}" dy="${bottomHalf ? 5.5 : 5}"><textPath href="#seat-${i}" startOffset="50%" text-anchor="middle">${label}</textPath></text>`;
    });

    return `<svg class="layer layer-table" viewBox="0 0 1000 1000" aria-hidden="true">
      <defs>
        ${filters}
        <clipPath id="tableClip"><circle cx="${C}" cy="${C}" r="${R_TABLE}"/></clipPath>
        <radialGradient id="woodShade" cx=".5" cy=".46" r=".52">
          <stop offset="0" stop-color="#ffd9a0" stop-opacity=".16"/>
          <stop offset=".55" stop-color="#000" stop-opacity="0"/>
          <stop offset=".9" stop-color="#000" stop-opacity=".38"/>
          <stop offset="1" stop-color="#000" stop-opacity=".62"/>
        </radialGradient>
        <linearGradient id="rimGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#f6df9a"/><stop offset=".25" stop-color="#b8892e"/>
          <stop offset=".5" stop-color="#e9c96e"/><stop offset=".75" stop-color="#8a6418"/>
          <stop offset="1" stop-color="#d9b458"/>
        </linearGradient>
        <radialGradient id="rimBevel" cx=".5" cy=".5" r=".5">
          <stop offset=".92" stop-color="#000" stop-opacity=".45"/><stop offset=".95" stop-color="#fff" stop-opacity=".15"/>
          <stop offset=".985" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".6"/>
        </radialGradient>
        <radialGradient id="rivet" cx=".35" cy=".35" r=".7">
          <stop offset="0" stop-color="#fff6d0"/><stop offset=".5" stop-color="#b8892e"/><stop offset="1" stop-color="#4a3408"/>
        </radialGradient>
        <radialGradient id="velvet" cx=".5" cy=".4" r=".65">
          <stop offset="0" stop-color="#5e2a78"/><stop offset=".6" stop-color="#3a1450"/><stop offset="1" stop-color="#1e0829"/>
        </radialGradient>
        <filter id="velvetTex" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" seed="5" result="n"/>
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .35 -.05" result="nn"/>
          <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="nn"/></feMerge>
          <feComposite in2="SourceAlpha" operator="in"/>
        </filter>
        <filter id="tableShadow" x="-10%" y="-10%" width="120%" height="125%">
          <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#000" flood-opacity=".8"/>
        </filter>
        <path id="mottoPath" d="M${C},${C} m-${R_MEDAL - 17},0 a${R_MEDAL - 17},${R_MEDAL - 17} 0 1,1 ${2 * (R_MEDAL - 17)},0 a${R_MEDAL - 17},${R_MEDAL - 17} 0 1,1 -${2 * (R_MEDAL - 17)},0"/>
      </defs>

      <!-- rim -->
      <circle cx="${C}" cy="${C}" r="${R_RIM}" fill="url(#rimGold)" filter="url(#tableShadow)"/>
      <circle cx="${C}" cy="${C}" r="${R_RIM}" fill="url(#rimBevel)"/>
      <circle cx="${C}" cy="${C}" r="${R_RIM - 2}" fill="none" stroke="#5a4210" stroke-width="1.5"/>
      ${rivets}
      ${engraving}

      <!-- wooden top -->
      <g clip-path="url(#tableClip)">
        ${planks}
        ${seams}
        <circle cx="${C}" cy="${C}" r="${R_TABLE}" fill="url(#woodShade)"/>
        ${dividers}
      </g>
      <circle cx="${C}" cy="${C}" r="${R_TABLE}" fill="none" stroke="#2a1605" stroke-width="5"/>
      <circle cx="${C}" cy="${C}" r="${R_TABLE - 14}" fill="none" stroke="#1f1007" stroke-width="1.6" opacity=".6" stroke-dasharray="2 5"/>

      <!-- centre medallion -->
      <circle cx="${C}" cy="${C}" r="${R_MEDAL + 20}" fill="#1f1007" opacity=".45"/>
      <circle cx="${C}" cy="${C}" r="${R_MEDAL + 10}" fill="url(#rimGold)"/>
      <circle cx="${C}" cy="${C}" r="${R_MEDAL + 10}" fill="none" stroke="#5a4210" stroke-width="1.5"/>
      <circle cx="${C}" cy="${C}" r="${R_MEDAL}" fill="url(#velvet)" filter="url(#velvetTex)"/>
      <circle cx="${C}" cy="${C}" r="${R_MEDAL - 5}" fill="none" stroke="#c9a13b" stroke-width="1.2"/>
      <circle cx="${C}" cy="${C}" r="${R_MEDAL - 29}" fill="none" stroke="#c9a13b" stroke-width=".8" opacity=".8"/>
      <text class="motto"><textPath href="#mottoPath" startOffset="0" textLength="${(2 * Math.PI * (R_MEDAL - 17) - 14).toFixed(0)}" lengthAdjust="spacing">✦ SCIENTIA · ARS · INGENIVM ✦ QVI GLADIVM ELIGIT · OPVS INVENIT ✦ PER · ARTEM · AD · ASTRA</textPath></text>
    </svg>`;
  }

  /* ------------------------------------------------------ 2. sword layer */

  function swordLayer() {
    let defs = "", swords = "";
    SWORDS.forEach((s, i) => {
      const id = `sw${i}`;
      const angle = 180 + i * STEP;
      defs += swordDefs(s.element, id) + shadowDef(id);
      const ext = s.external ? ` target="_self" rel="noopener"` : "";
      swords += `
      <a class="sword" href="${s.href}"${ext} data-index="${i}" data-element="${s.element}"
         aria-label="${ELEMENTS[s.element].label} sword: ${s.title}"
         style="--glow:${ELEMENTS[s.element].glow}">
        <g transform="translate(${C} ${C}) rotate(${angle}) translate(0 ${R_TIP}) scale(1.06)">
          <g class="sword-lift">
            <rect class="sword-hit" x="-34" y="-8" width="68" height="${SWORD_LENGTH + 14}" fill="transparent"/>
            ${swordArt(s.element, id)}
          </g>
        </g>
      </a>`;
    });
    return `<svg class="layer layer-swords" viewBox="0 0 1000 1000">
      <defs>${defs}</defs>
      <g class="swords">${swords}</g>
    </svg>`;
  }

  /* ------------------------------------------------------ 3. title layer */

  function titleLayer() {
    const [first, ...rest] = OWNER.name.split(" ");
    return `<svg class="layer layer-title" viewBox="0 0 1000 1000">
      <defs>
        <linearGradient id="titleGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#fff1bf"/><stop offset=".45" stop-color="#e3b94f"/><stop offset="1" stop-color="#9c6f1c"/>
        </linearGradient>
        <radialGradient id="chosenFlash" cx=".5" cy=".5" r=".5">
          <stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop class="flash-stop" offset=".4" stop-opacity=".6"/>
          <stop class="flash-stop" offset="1" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <circle class="centre-flash" cx="${C}" cy="${C}" r="${R_MEDAL}" fill="url(#chosenFlash)"/>
      <text class="title-kicker" x="${C}" y="394" text-anchor="middle">THE PORTFOLIO OF</text>
      <path d="M${C - 84},410 H${C - 12} M${C + 12},410 H${C + 84}" stroke="#c9a13b" stroke-width="1"/>
      <path d="M${C},403 l5,7 l-5,7 l-5,-7 Z" fill="#c9a13b"/>
      <text class="title-name" x="${C}" y="474" text-anchor="middle">${first}</text>
      <text class="title-name" x="${C}" y="540" text-anchor="middle">${rest.join(" ")}</text>
      <path d="M${C - 104},560 C${C - 60},548 ${C - 30},572 ${C},560 C${C + 30},548 ${C + 60},572 ${C + 104},560" fill="none" stroke="#c9a13b" stroke-width="1.1"/>
      <text class="title-choice" id="choice" x="${C}" y="590" text-anchor="middle">✦ Choose thy blade ✦</text>
    </svg>`;
  }

  root.innerHTML = tableLayer() + swordLayer() + titleLayer();

  /* ------------------------------------------------------------ legend */

  legend.innerHTML = SWORDS.map((s, i) => `
    <li><a href="${s.href}" data-index="${i}" style="--glow:${ELEMENTS[s.element].glow}">
      <span class="roll-element">${ELEMENTS[s.element].label}</span>
      <span class="roll-title">${s.title}</span>
    </a></li>`).join("");

  /* ------------------------------------------------------- interaction */

  const swordEls = [...root.querySelectorAll(".sword")];
  const rimTexts = [...root.querySelectorAll(".rim-text")];
  const legendLinks = [...legend.querySelectorAll("a")];
  const choice = document.getElementById("choice");
  const defaultChoice = choice.textContent;
  let chosen = false;

  // Keep the centre caption within the medallion however long the title is.
  const CHOICE_MAX = 250;
  function fitChoice() {
    choice.removeAttribute("textLength");
    if (choice.getComputedTextLength() > CHOICE_MAX) {
      choice.setAttribute("textLength", CHOICE_MAX);
      choice.setAttribute("lengthAdjust", "spacingAndGlyphs");
    }
  }

  function highlight(i) {
    if (chosen) return;
    swordEls.forEach((el, j) => {
      const on = j === i;
      el.classList.toggle("is-active", on);
      el.querySelector(".sword-body").setAttribute("filter", `url(#sw${j}-${on ? "glow" : "shadow"})`);
    });
    rimTexts.forEach((t, j) => t.classList.toggle("is-active", j === i));
    legendLinks.forEach((a, j) => a.classList.toggle("is-active", j === i));
    root.classList.toggle("has-active", i != null);
    if (i == null) {
      choice.textContent = defaultChoice;
      choice.style.fill = "";
    } else {
      const s = SWORDS[i];
      choice.textContent = `${ELEMENTS[s.element].label} · ${s.title}`;
      choice.style.fill = ELEMENTS[s.element].glow;
    }
    fitChoice();
  }

  function choose(i, event) {
    // Let modified clicks (new tab / window) behave normally.
    if (event && (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1)) return;
    if (event) event.preventDefault();
    if (chosen) return;
    highlight(i);
    chosen = true;
    root.style.setProperty("--flash", ELEMENTS[SWORDS[i].element].glow);
    root.classList.add("is-chosen");
    swordEls[i].classList.add("is-chosen");
    setTimeout(() => { window.location.href = SWORDS[i].href; }, reduceMotion ? 120 : 850);
  }

  [...swordEls, ...legendLinks].forEach((el) => {
    const i = Number(el.dataset.index);
    el.addEventListener("mouseenter", () => highlight(i));
    el.addEventListener("mouseleave", () => highlight(null));
    el.addEventListener("focus", () => highlight(i));
    el.addEventListener("blur", () => highlight(null));
    el.addEventListener("click", (e) => choose(i, e));
  });

  // Coming back via the browser's back button restores a page frozen mid-animation.
  window.addEventListener("pageshow", (e) => {
    if (!e.persisted) return;
    chosen = false;
    root.classList.remove("is-chosen");
    swordEls.forEach((el) => el.classList.remove("is-chosen"));
    highlight(null);
  });
})();
