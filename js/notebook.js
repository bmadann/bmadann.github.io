/*
 * Renders a Jupyter notebook (.ipynb) and Markdown into the page, in the
 * site's style. Needs marked and KaTeX, loaded by classwork.html.
 */
const NotebookView = (() => {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const text = (v) => (Array.isArray(v) ? v.join("") : v || "");
  const COLLAPSE_OVER = 30; // code cells longer than this start folded

  /** Markdown → HTML. Maths is set aside first so Markdown can't mangle it. */
  function markdown(source) {
    const maths = [];
    const hold = (tex, display) => `@@MATH${maths.push({ tex, display }) - 1}@@`;
    const prepared = source
      .replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => hold(tex, true))
      .replace(/\$([^$\n]+?)\$/g, (_, tex) => hold(tex, false));
    return marked.parse(prepared).replace(/@@MATH(\d+)@@/g, (_, i) =>
      katex.renderToString(maths[i].tex, { displayMode: maths[i].display, throwOnError: false }));
  }

  function outputMarkup(out) {
    if (out.output_type === "stream") {
      return out.name === "stderr" ? "" : `<pre class="nb-text">${esc(text(out.text))}</pre>`;
    }
    const data = out.data || {};
    if (data["image/png"]) return `<img class="nb-figure" src="data:image/png;base64,${text(data["image/png"]).replace(/\s/g, "")}" alt="Plot produced by this cell" loading="lazy">`;
    if (data["application/vnd.jupyter.widget-view+json"]) return `<p class="nb-note">This cell has an interactive control. Open the notebook in Colab to use it.</p>`;
    if (data["text/plain"]) return `<pre class="nb-text">${esc(text(data["text/plain"]))}</pre>`;
    return "";
  }

  function codeMarkup(cell, index) {
    const source = text(cell.source);
    const title = (source.match(/^#@title\s+(.+?)(\s*\{.*\})?\s*$/m) || [])[1];
    const lines = source.split("\n").length;
    const frame = `<div class="code-frame code-bubble" data-cell="${index}">
        <div class="code-bar">
          <span class="code-path">${esc(title || `Cell ${index}`)}</span>
          <span class="code-actions"><button class="code-btn" type="button" data-copy>Copy</button></span>
        </div>
        <div class="code-body">
          <ol class="code-gutter" aria-hidden="true"></ol>
          <pre><code></code></pre>
        </div>
      </div>`;
    const outputs = (cell.outputs || []).map(outputMarkup).join("");
    return `<div class="nb-cell">
      ${lines > COLLAPSE_OVER ? `<details class="nb-fold"><summary>${esc(title || `Cell ${index}`)} (${lines} lines of code)</summary>${frame}</details>` : frame}
      ${outputs ? `<div class="nb-outputs">${outputs}</div>` : ""}
    </div>`;
  }

  /** `paint(codeEl, gutter, source)` highlights a code block; `copy(button, source)` wires its Copy button. */
  async function render(container, url, { paint, copy }) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    const { cells } = await res.json();
    container.innerHTML = cells.map((cell, i) =>
      cell.cell_type === "markdown" ? `<div class="nb-md">${markdown(text(cell.source))}</div>`
      : cell.cell_type === "code" ? codeMarkup(cell, i) : "").join("");
    container.querySelectorAll("[data-cell]").forEach((frame) => {
      const source = text(cells[Number(frame.dataset.cell)].source);
      paint(frame.querySelector("code"), frame.querySelector(".code-gutter"), source);
      const button = frame.querySelector("[data-copy]");
      button.addEventListener("click", () => copy(button, source));
    });
  }

  return { render, markdown };
})();
