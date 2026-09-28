/*
 * Renders the content pages. Each HTML page sets <body data-page="…">:
 *   project   – project.html?p=<id> (PROJECTS)
 *   resume    – resume.html
 *   classwork – classwork.html
 */

(function () {
  const main = document.getElementById("page");
  const kind = document.body.dataset.page;

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const repoUrl = (repo) => `https://github.com/${OWNER.github}/${repo}`;
  const rawUrl = (repo, branch, path) => `https://raw.githubusercontent.com/${OWNER.github}/${repo}/${branch}/${path.split("/").map(encodeURIComponent).join("/")}`;
  const blobUrl = (repo, branch, path) => `${repoUrl(repo)}/blob/${branch}/${path.split("/").map(encodeURIComponent).join("/")}`;

  function setElement(el) {
    document.documentElement.style.setProperty("--accent", ELEMENTS[el].accent);
    document.documentElement.style.setProperty("--glow", ELEMENTS[el].glow);
  }

  function hero({ element, kicker, title, tagline, actions = "" }) {
    return `<section class="hero">
      <div class="hero-emblem">${swordEmblem(element)}</div>
      <p class="hero-kicker">${kicker}</p>
      <h1 class="hero-title">${title}</h1>
      ${tagline ? `<p class="hero-tagline">${tagline}</p>` : ""}
      ${actions ? `<div class="hero-actions">${actions}</div>` : ""}
    </section>`;
  }

  const panel = (title, body, cls = "") => `<section class="panel ${cls}">
      <h2 class="panel-title"><span>${title}</span></h2>
      ${body}
    </section>`;

  /* ------------------------------------------------------------ project */

  function renderProject() {
    const id = new URLSearchParams(location.search).get("p");
    const proj = PROJECTS[id];

    if (!proj) {
      setElement("time");
      document.title = "Unknown Blade · Benjamin Madan";
      main.innerHTML = hero({ element: "time", kicker: "Lost to the ages", title: "No Such Blade", tagline: "This path leads nowhere. Return to the Round Table and choose again." });
      return;
    }

    setElement(proj.element);
    document.title = `${proj.title} · Benjamin Madan`;

    const links = proj.links
      ? proj.links.map((l) => `<a class="btn" href="${repoUrl(l.repo)}">${esc(l.label)} on GitHub</a>`).join("")
      : proj.repo ? `<a class="btn" href="${repoUrl(proj.repo)}">View on GitHub</a>` : "";

    const kicker = `The Blade of ${ELEMENTS[proj.element].label}`;

    const tale = (proj.tale || []).map((p) => `<p>${p}</p>`).join("");
    const deeds = proj.features && proj.features.length
      ? `<div><h3>Features</h3><ul class="deeds">${proj.features.map((f) => `<li>${f}</li>`).join("")}</ul></div>` : "";
    const forged = proj.tech && proj.tech.length
      ? `<div><h3>Forged With</h3><ul class="tags">${proj.tech.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>` : "";

    main.innerHTML =
      hero({ element: proj.element, kicker, title: esc(proj.title), tagline: esc(proj.tagline || ""), actions: links }) +
      panel("What It Does", `<div class="tale">${tale}</div><div class="tale-grid">${deeds}${forged}</div>`) +
      (proj.files && proj.files.length ? panel("The Code", codeViewerMarkup(proj), "panel-code") : "");

    if (proj.files && proj.files.length) initCodeViewer(proj);
  }

  /* -------------------------------------------------------- code viewer */

  /** Highlights `text` into `codeEl` and numbers the lines in `gutter`. */
  function paintCode(codeEl, gutter, text, lang) {
    codeEl.className = `hljs language-${lang}`;
    if (window.hljs && hljs.getLanguage(lang)) {
      codeEl.innerHTML = hljs.highlight(text, { language: lang, ignoreIllegals: true }).value;
    } else {
      codeEl.textContent = text;
    }
    const lines = text.replace(/\n$/, "").split("\n").length;
    gutter.innerHTML = Array.from({ length: lines }, (_, i) => `<li>${i + 1}</li>`).join("");
  }

  async function copyText(button, text) {
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = "Copied";
    } catch {
      button.textContent = "Copy failed";
    }
    setTimeout(() => (button.textContent = "Copy"), 1600);
  }

  function codeViewerMarkup(proj) {
    const tabs = proj.files.map((f, i) => {
      const label = f.label || f.path.split("/").pop();
      return `<button class="code-tab" role="tab" id="tab-${i}" aria-controls="code-frame" aria-selected="${i === 0}" data-i="${i}" title="${esc(f.path)}">${esc(label)}</button>`;
    }).join("");
    return `
      <div class="code-tabs" role="tablist" aria-label="Source files">${tabs}</div>
      <div class="code-frame" id="code-frame" role="tabpanel">
        <div class="code-bar">
          <span class="code-path" id="code-path"></span>
          <span class="code-actions">
            <button class="code-btn" id="code-copy" type="button">Copy</button>
            <a class="code-btn" id="code-open" href="#">Open on GitHub</a>
          </span>
        </div>
        <div class="code-body" id="code-body">
          <ol class="code-gutter" id="code-gutter" aria-hidden="true"></ol>
          <pre><code id="code"></code></pre>
        </div>
      </div>`;
  }

  function initCodeViewer(proj) {
    const cache = new Map();
    const tabs = [...document.querySelectorAll(".code-tab")];
    const codeEl = document.getElementById("code");
    const gutter = document.getElementById("code-gutter");
    const pathEl = document.getElementById("code-path");
    const openEl = document.getElementById("code-open");
    const copyEl = document.getElementById("code-copy");
    const body = document.getElementById("code-body");
    let current = 0;

    function paint(text, lang) {
      paintCode(codeEl, gutter, text, lang);
      body.scrollTop = 0;
      body.scrollLeft = 0;
    }

    async function show(i) {
      current = i;
      const f = proj.files[i];
      const repo = f.repo || proj.repo;
      const branch = f.branch || proj.branch || "HEAD";
      tabs.forEach((t, j) => {
        t.setAttribute("aria-selected", j === i);
        t.tabIndex = j === i ? 0 : -1;
      });
      pathEl.textContent = `${repo} / ${f.path}`;
      openEl.href = blobUrl(repo, branch, f.path);

      if (!cache.has(i)) {
        gutter.innerHTML = "";
        codeEl.className = "";
        codeEl.innerHTML = `<span class="code-status">Unsheathing the code…</span>`;
        try {
          const res = await fetch(rawUrl(repo, branch, f.path));
          if (!res.ok) throw new Error(res.status);
          cache.set(i, await res.text());
        } catch (err) {
          if (current !== i) return;
          codeEl.innerHTML = `<span class="code-status">The code could not be summoned (${esc(err.message)}). <a href="${blobUrl(repo, branch, f.path)}">Read it on GitHub instead.</a></span>`;
          return;
        }
      }
      if (current !== i) return; // a different tab was chosen while loading
      paint(cache.get(i), f.lang || "plaintext");
    }

    tabs.forEach((t, i) => {
      t.addEventListener("click", () => show(i));
      t.addEventListener("keydown", (e) => {
        const dir = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
        if (!dir) return;
        const next = (i + dir + tabs.length) % tabs.length;
        tabs[next].focus();
        show(next);
      });
    });

    copyEl.addEventListener("click", () => {
      if (cache.has(current)) copyText(copyEl, cache.get(current));
    });

    show(0);
  }

  /* ------------------------------------------------------------- resume */

  async function renderResume() {
    setElement("earth");
    const pdf = "assets/resume.pdf";
    main.innerHTML =
      hero({
        element: "earth",
        kicker: "The Blade of Earth",
        title: "Resume",
        tagline: "Experience, education and skills.",
        actions: `<a class="btn" href="${OWNER.linkedin}">LinkedIn</a><a class="btn" href="https://github.com/${OWNER.github}">GitHub</a>`,
      }) + `<div id="resume-body"></div>`;

    const slot = document.getElementById("resume-body");
    let found = false;
    try {
      found = (await fetch(pdf, { method: "HEAD" })).ok;
    } catch { /* offline or opened from disk */ }

    if (found) {
      slot.innerHTML = panel("The Scroll", `
        <div class="resume-actions"><a class="btn" href="${pdf}" download>Download PDF</a><a class="btn btn-quiet" href="${pdf}">Open in new view</a></div>
        <iframe class="resume-frame" src="${pdf}#view=FitH" title="Benjamin Madan resume"></iframe>`);
    } else {
      slot.innerHTML = panel("The Scroll", `
        <div class="sealed">
          ${waxSeal()}
          <p class="sealed-title">The scroll is still being written.</p>
          <p>The resume will appear here soon. In the meantime, you can find me on <a href="${OWNER.linkedin}">LinkedIn</a>.</p>
        </div>`);
    }
  }

  /* ---------------------------------------------------------- classwork */

  function renderClasswork() {
    setElement("time");
    const intro = hero({
      element: "time",
      kicker: "The Blade of Time",
      title: "Class Work",
      tagline: "Coursework, assignments and projects from my studies.",
    });

    if (!CLASSWORK.length) {
      main.innerHTML = intro + panel("The Archive", `
        <div class="sealed">
          ${waxSeal()}
          <p class="sealed-title">The archive is sealed for now.</p>
          <p>Class work is being gathered and will be added here soon.</p>
        </div>`);
      return;
    }

    main.innerHTML = intro + CLASSWORK.map(classworkMarkup).join("");
    CLASSWORK.forEach(loadClassworkCode);
  }

  function classworkMarkup(work) {
    const kicker = [work.course, work.term].filter(Boolean).map(esc).join(" · ");
    const contents = work.sections.map((sec, i) =>
      `<li><a href="#${work.id}-${i + 1}">${esc(sec.title)}</a></li>`).join("");
    const sections = work.sections.map((sec, i) => `
      <section class="study" id="${work.id}-${i + 1}">
        <h3 class="study-title"><span class="study-num">${toRoman(i + 1)}</span>${esc(sec.title)}</h3>
        <p class="study-text">${esc(sec.text)}</p>
        <div class="code-frame code-bubble">
          <div class="code-bar">
            <span class="code-path">${esc(sec.file)}</span>
            <span class="code-actions"><button class="code-btn" type="button" data-copy>Copy</button></span>
          </div>
          <div class="code-body">
            <ol class="code-gutter" aria-hidden="true"></ol>
            <pre><code><span class="code-status">Unsheathing the code…</span></code></pre>
          </div>
        </div>
      </section>`).join("");

    return `<section class="panel classwork" id="${work.id}">
      ${kicker ? `<p class="work-kicker">${kicker}</p>` : ""}
      <h2 class="panel-title"><span>${esc(work.title)}</span></h2>
      ${work.tagline ? `<p class="work-tagline">${esc(work.tagline)}</p>` : ""}
      <div class="tale">${(work.intro || []).map((p) => `<p>${esc(p)}</p>`).join("")}</div>
      ${work.tech ? `<ul class="tags work-tags">${work.tech.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
      <nav class="work-contents" aria-label="Sections"><ol>${contents}</ol></nav>
      ${sections}
    </section>`;
  }

  function loadClassworkCode(work) {
    work.sections.forEach(async (sec, i) => {
      const block = document.getElementById(`${work.id}-${i + 1}`);
      const codeEl = block.querySelector("code");
      const gutter = block.querySelector(".code-gutter");
      let text;
      try {
        const res = await fetch(`${work.dir}/${sec.file}`);
        if (!res.ok) throw new Error(res.status);
        text = await res.text();
      } catch (err) {
        codeEl.innerHTML = `<span class="code-status">The code could not be summoned (${esc(err.message)}).</span>`;
        return;
      }
      paintCode(codeEl, gutter, text, sec.lang || "python");
      const copy = block.querySelector("[data-copy]");
      copy.addEventListener("click", () => copyText(copy, text));
    });
  }

  function toRoman(n) {
    return [["X", 10], ["IX", 9], ["V", 5], ["IV", 4], ["I", 1]].reduce((out, [r, v]) => {
      while (n >= v) { out += r; n -= v; }
      return out;
    }, "");
  }

  function waxSeal() {
    return `<svg class="wax-seal" viewBox="0 0 120 120" aria-hidden="true">
      <defs><radialGradient id="wax" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#d23a4f"/><stop offset=".6" stop-color="#8a1224"/><stop offset="1" stop-color="#4a0610"/></radialGradient></defs>
      <path d="M60,6 C72,4 78,12 88,12 C98,14 104,24 108,32 C114,42 112,52 114,60 C116,72 108,78 106,88 C102,98 92,104 84,108 C74,114 66,112 58,114 C46,116 40,108 30,104 C20,100 14,92 10,82 C6,72 8,64 6,56 C4,44 12,38 16,28 C20,18 30,14 38,10 C46,6 52,8 60,6 Z" fill="url(#wax)"/>
      <circle cx="60" cy="60" r="36" fill="none" stroke="#5a0814" stroke-width="3"/>
      <circle cx="60" cy="60" r="31" fill="none" stroke="#e46a7c" stroke-width="1" opacity=".5"/>
      <text x="60" y="76" text-anchor="middle" font-family="UnifrakturCook, serif" font-size="44" fill="#5a0814">B</text>
      <text x="61.5" y="74.5" text-anchor="middle" font-family="UnifrakturCook, serif" font-size="44" fill="#e46a7c" opacity=".45">B</text>
    </svg>`;
  }

  ({ project: renderProject, resume: renderResume, classwork: renderClasswork })[kind]();
})();
