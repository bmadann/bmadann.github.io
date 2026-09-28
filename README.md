# The Round Table: Benjamin Madan's portfolio

A static site for GitHub Pages (`bmadann.github.io`). No build step: push to `main` and it's live.

## Preview locally

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

## Editing content

Almost everything lives in [`js/data.js`](js/data.js):

- `OWNER.linkedin`: your LinkedIn URL (the Wind sword).
- `SWORDS`: the nine swords, clockwise from the top: element, label and destination.
- `PROJECTS`: project pages (`project.html?p=<id>`). Code tabs are fetched live from GitHub, so listing a file `path` is enough.
- `CLASSWORK`: class work shown in full on `classwork.html`. Each entry has an intro and a list of sections (explanation + code file); the code files live under `classwork/<entry>/`.

**Resume:** put a PDF at `assets/resume.pdf` and the Resume page will embed it.

## Layout

| Path | Purpose |
| --- | --- |
| `index.html`, `js/table.js`, `css/table.css` | The Round Table home page |
| `js/swords.js` | SVG art for the nine elemental swords |
| `project.html`, `resume.html`, `classwork.html`, `js/page.js`, `css/page.css` | Content pages |
| `css/realm.css` | Shared palette, stone hall background and sword animations |
| `assets/` | Stone texture, banners, favicon (and your `resume.pdf`) |
