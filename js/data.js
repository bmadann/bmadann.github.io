/*
 * The Round Table's ledger.
 * Every sword, page, and project on the site is described here, so most
 * content changes only need an edit to this file.
 */

const OWNER = {
  name: "Benjamin Madan",
  github: "bmadann",
  linkedin: "https://www.linkedin.com/in/benjamin-madan",
};

/*
 * Elements give each sword and page its palette.
 *   glow   – aura / highlight colour
 *   accent – borders, headings and links on the element's page
 */
const ELEMENTS = {
  fire:      { label: "Fire",      glow: "#ff6a1a", accent: "#ff8a3d" },
  water:     { label: "Water",     glow: "#3cc8ff", accent: "#5cc9f0" },
  wind:      { label: "Wind",      glow: "#d8f3ff", accent: "#bfe3f2" },
  wood:      { label: "Wood",      glow: "#8ee36b", accent: "#9ccf6e" },
  earth:     { label: "Earth",     glow: "#e0a24e", accent: "#d9a35b" },
  space:     { label: "Space",     glow: "#a98bff", accent: "#b39dff" },
  machinery: { label: "Machinery", glow: "#f2b134", accent: "#e6b04a" },
  glass:     { label: "Glass",     glow: "#c6f6ff", accent: "#a9e9f5" },
  time:      { label: "Time",      glow: "#ffe08a", accent: "#f0cf6e" },
};

/*
 * The nine swords, clockwise from the top of the table.
 * `href` is where the sword leads when chosen.
 */
const SWORDS = [
  { element: "earth",     title: "Resume",               href: "resume.html" },
  { element: "wind",      title: "LinkedIn",             href: OWNER.linkedin, external: true },
  { element: "machinery", title: "Data Governance",      href: "project.html?p=data-governance" },
  { element: "water",     title: "SpotDL",               href: "project.html?p=spotdl" },
  { element: "fire",      title: "Max/MSP Synthesis",    href: "project.html?p=max-synthesis" },
  { element: "glass",     title: "Instagram Clone",      href: "project.html?p=instagram-clone" },
  { element: "wood",      title: "React + TypeScript",   href: "project.html?p=react-typescript" },
  { element: "space",     title: "Group Portfolio",      href: "project.html?p=group-portfolio" },
  { element: "time",      title: "Class Work",           href: "classwork.html" },
];

/*
 * Project pages. Code files are fetched live from GitHub:
 *   https://raw.githubusercontent.com/<OWNER.github>/<repo>/<branch>/<path>
 * `lang` is a highlight.js language name.
 */
const PROJECTS = {
  "data-governance": {
    element: "machinery",
    title: "Data Governance Control Tower",
    tagline: "An enterprise-style data quality pipeline for credit card transactions.",
    repo: "Data_Governance_Project",
    tale: [
      "This project simulates the data management workflow a large card issuer runs every day. Raw transaction data is loaded into a staging layer, then transformed into a governed, curated table with consistent names and types.",
      "Automated data quality controls then run against the curated table. Each control has a threshold. Every run is written to an audit log with its pass/fail result, the number of failing rows, the threshold and the script version. Sample failing rows are captured so an analyst can investigate them.",
      "Written policy and lineage documents sit alongside the code. They define the critical data elements and trace each field from the raw CSV through to the monitoring outputs.",
    ],
    features: [
      "Staging → curated SQL transform (<code>Time</code> → <code>event_time_seconds</code>, <code>Class</code> → <code>is_fraud</code>, typed casts)",
      "Controls for nulls in core fields and features, non-negative amounts and times, binary fraud flags, fraud-rate reasonableness and expected row counts",
      "Monitoring checks for extreme amounts, zero-amount transactions and outlier feature values",
      "Audit table <code>dq_results</code> that migrates its own schema in place between versions",
      "Exception sampling into <code>dq_exceptions</code>, capped per check per run",
    ],
    tech: ["Python", "SQLite", "SQL", "Data Governance"],
    files: [
      { path: "src/quality/run_checks_curated_v2.py", lang: "python" },
      { path: "sql/marts/create_curated.sql",         lang: "sql" },
      { path: "src/ingest/load_sqlite.py",             lang: "python" },
      { path: "src/quality/snapshot_profile.py",       lang: "python" },
      { path: "docs/policy.md",                        lang: "markdown" },
      { path: "docs/lineage.md",                       lang: "markdown" },
    ],
  },

  "spotdl": {
    element: "water",
    title: "SpotDL",
    tagline: "A small command-line tool for downloading Spotify playlists, albums and tracks.",
    repo: "SpotDL",
    tale: [
      "SpotDL is a Python wrapper around the open-source spotify-dl tool. You paste in a Spotify link (a playlist, an album or a single track) and it downloads the music into a local folder.",
      "The script creates the download folder if needed, calls spotify-dl as a subprocess, and reports success or failure. If a download fails, it removes the empty folder it created.",
    ],
    features: [
      "Interactive prompt that accepts any Spotify playlist, album or track link",
      "Creates the download folder automatically",
      "Uses <code>subprocess.run(..., check=True)</code> so failures are caught and reported",
      "Removes empty download folders after a failed run",
    ],
    tech: ["Python", "CLI", "subprocess"],
    files: [
      { path: "spotDown.py", lang: "python" },
      { path: "README.md",   lang: "markdown" },
    ],
  },

  "max-synthesis": {
    element: "fire",
    title: "Max/MSP Sound Synthesis",
    tagline: "A semester of sound synthesis and algorithmic composition patches built in Max.",
    repo: "MAX-Files",
    tale: [
      "Max is a visual programming language for audio: you build programs by wiring objects together on a canvas. This repository holds a semester of patches, working up from single oscillators to complete synthesizers and generative composition tools.",
      "It covers basic waveforms and ADSR envelopes, monophonic and additive synths, polyphonic voices, ring, amplitude and frequency modulation, Euclidean rhythm generators, Monte Carlo melody generation, wavetable and waveshaping synthesis, wavefolding and distortion, low-pass filters and envelope following.",
      "Max saves patches as JSON, so the code below is each patch's object graph: its boxes (objects) and patch lines (connections). Files prefixed <code>bm.</code> are my own compositions.",
    ],
    features: [
      "ADSR envelopes, monosynth and additive synthesis",
      "Polyphonic synthesis with <code>poly~</code> and the bach library",
      "RM / AM / FM modulation on waveforms and signals",
      "Generative melody patches using distributions and Monte Carlo methods",
      "Wavetable, waveshaping, wavefolding and distortion bands",
    ],
    tech: ["Max/MSP", "DSP", "Synthesis", "Algorithmic Composition"],
    files: [
      { path: "week8/bm.make-a-melody.v02.maxpat",    lang: "json" },
      { path: "week11/assignment.week11.maxpat",      lang: "json" },
      { path: "week11/wavefolder.modified.maxpat",    lang: "json" },
      { path: "week3/02.ADSR.maxpat",                 lang: "json" },
      { path: "week4/03.monosynth.maxpat",            lang: "json" },
    ],
  },

  "instagram-clone": {
    element: "glass",
    title: "Instagram Clone",
    tagline: "A React recreation of Instagram, built twice: first the interface, then with authentication and state management.",
    repo: "instagram-clone-tailwind-firebase",
    links: [
      { label: "Version I", repo: "instagram-clone" },
      { label: "Version II", repo: "instagram-clone-tailwind-firebase" },
    ],
    tale: [
      "The first version recreates Instagram's interface in React: a side navigation bar, a scrolling timeline of posts and a suggestions panel, each as its own component with its own styles.",
      "The second version adds a working backend. Firebase Authentication handles sign-up and log-in, a listener keeps users signed in across reloads, and a Redux Toolkit slice holds the current user and loading state for the whole app. The styling moves to Tailwind CSS.",
    ],
    features: [
      "Component structure: <code>Sidenav</code>, <code>Timeline</code>, <code>Post</code>, <code>Suggestions</code>",
      "Firebase email/password sign-up and log-in",
      "Persistent sessions via <code>onAuthStateChanged</code>",
      "Global user state with a Redux Toolkit slice",
      "Tailwind CSS utility styling",
    ],
    tech: ["React", "Firebase", "Redux Toolkit", "Tailwind CSS", "JavaScript"],
    files: [
      { repo: "instagram-clone-tailwind-firebase", path: "react-instagram-clone/src/App.js",                   lang: "javascript", label: "II · App.js" },
      { repo: "instagram-clone-tailwind-firebase", path: "react-instagram-clone/src/features/userSlice.js",    lang: "javascript", label: "II · userSlice.js" },
      { repo: "instagram-clone-tailwind-firebase", path: "react-instagram-clone/src/authenticate/Login.js",    lang: "javascript", label: "II · Login.js" },
      { repo: "instagram-clone-tailwind-firebase", path: "react-instagram-clone/src/authenticate/Signup.js",   lang: "javascript", label: "II · Signup.js" },
      { repo: "instagram-clone-tailwind-firebase", path: "react-instagram-clone/src/timeline/Timeline.js",     lang: "javascript", label: "II · Timeline.js" },
      { repo: "instagram-clone",                   path: "src/Homepage.js",                                    lang: "javascript", label: "I · Homepage.js" },
      { repo: "instagram-clone",                   path: "src/timeline/posts/Post.js",                         lang: "javascript", label: "I · Post.js" },
      { repo: "instagram-clone",                   path: "src/navigation/Sidenav.js",                          lang: "javascript", label: "I · Sidenav.js" },
    ],
  },

  "react-typescript": {
    element: "wood",
    title: "React + TypeScript Components",
    tagline: "A set of reusable, strongly typed React components built with Vite.",
    repo: "React",
    tale: [
      "A Vite + React + TypeScript project for building reusable UI components with typed props. Each component defines an interface for its props, so wrong usage fails at compile time instead of in the browser.",
      "The components are a dismissible Alert, a Button with a fixed set of colour variants, and a ListGroup that tracks the selected item in state and reports selections to its parent through a callback.",
    ],
    features: [
      "Typed props interfaces for every component",
      "<code>Button</code> colour limited to <code>'primary' | 'secondary' | 'danger'</code>",
      "<code>ListGroup</code> with selection state and an <code>onSelectItem</code> callback",
      "Conditional rendering of a dismissible <code>Alert</code>",
    ],
    tech: ["React", "TypeScript", "Vite", "Bootstrap"],
    files: [
      { path: "src/App.tsx",                  lang: "typescript" },
      { path: "src/components/ListGroup.tsx", lang: "typescript" },
      { path: "src/components/Button.tsx",    lang: "typescript" },
      { path: "src/components/Alert.tsx",     lang: "typescript" },
      { path: "src/main.tsx",                 lang: "typescript" },
    ],
  },

  "group-portfolio": {
    element: "space",
    title: "Group Portfolio: Uses of CSS",
    tagline: "A collaborative web page explaining how CSS shapes the space of a document.",
    repo: "Group-Portfolio",
    tale: [
      "A group project that explains Cascading Style Sheets as a web page styled with CSS. It covers what CSS is and why it matters: separating content from design, keeping a consistent look across pages, and reducing file size.",
      "The page uses semantic HTML (header, main, sections and footer) with all styling kept in a separate stylesheet.",
    ],
    features: [
      "Semantic HTML5 document structure",
      "Content and presentation kept separate",
      "Collaborative development through Git",
    ],
    tech: ["HTML", "CSS", "Teamwork"],
    files: [
      { path: "index.html", lang: "xml" },
      { path: "style.css",  lang: "css" },
    ],
  },
};

/*
 * Class work. Each entry is a tab on classwork.html (`tab` is its label, and
 * the first entry opens by default). Files live in `dir` inside this repo.
 *
 * An entry is one of two kinds:
 *   notebook – renders `dir/<notebook>` (.ipynb), under the written piece in
 *              `dir/<story>` (Markdown), which is left out while it is empty
 *   sections – an intro, then each section's explanation and its code file
 */
const CLASSWORK = [
  {
    id: "project-2",
    tab: "Project 2",
    course: "DCS 340 Project II",
    term: "Fall 2026",
    title: "Evolving Quantum Circuits",
    tech: ["Python", "NumPy", "Qiskit", "Matplotlib"],
    dir: "classwork/project-2",
    story: "story.md",
    notebook: "Evolving_Quantum_Circuits.ipynb",
  },
  {
    id: "play-and-explore",
    tab: "Play & Explore",
    course: "Evolutionary Computing",
    term: "Fall 2026",
    title: "Play & Explore: Optimization Methods",
    tagline: "Working up from one-dimensional gradient ascent to Newton's method and Gauss–Newton in two dimensions.",
    intro: [
      "A notebook exploring how different algorithms find the peak (or bottom) of a function. It starts with a single-variable parabola, where every method should agree the maximum is at x = 2, then moves on to a cubic with both a maximum and a minimum, a two-variable surface, and finally a system of nonlinear equations.",
    ],
    tech: ["Python", "NumPy", "Matplotlib"],
    dir: "classwork/play-and-explore",
    sections: [
      {
        title: "Gradient Ascent",
        file: "01_gradient_ascent.py",
        text: "The simplest way to climb a hill: look at the slope where you are and take a small step uphill. The derivative of f(x) = −(x − 2)² tells us which way is up, and the learning rate controls how big each step is. After 48 fixed steps, x has crept up to 2, the top of the parabola.",
      },
      {
        title: "Knowing When to Stop",
        file: "02_convergence.py",
        text: "Running a fixed number of steps is wasteful if we've already arrived, and not enough if we haven't. This version adds a tolerance: once the slope is essentially zero, the function is flat and we're at the peak, so the loop stops on its own. It converges after 69 steps.",
      },
      {
        title: "Bisection",
        file: "03_bisection.py",
        text: "A completely different approach that ignores step sizes altogether. Since the maximum is where the derivative crosses zero, we start with an interval where the derivative changes sign, then repeatedly cut it in half and keep whichever half still contains the sign change. Slow but guaranteed to close in on x = 2.",
      },
      {
        title: "Newton's Method",
        file: "04_newton.py",
        text: "Newton's method uses the second derivative (the curvature) as well as the slope, which lets it estimate exactly how far away the peak is instead of taking cautious small steps. For a parabola the curvature is constant, so a single step lands right on the answer.",
      },
      {
        title: "Newton's Method, Visualized",
        file: "05_newton_quadratic.py",
        text: "The same idea applied to f(x) = −x² + 4x + 1, this time recording every point Newton visits and plotting them on the curve. The numbered dots make it clear that the method jumps from the starting point to the maximum in one move and then stays put.",
      },
      {
        title: "Finding Every Peak and Valley",
        file: "06_newton_cubic.py",
        text: "A cubic like x³ − 3x has both a local maximum and a local minimum, and Newton's method will head toward whichever critical point is closest to where it starts. By launching it from 50 different starting guesses and collecting the unique results, the code discovers both critical points (x = −1 and x = 1), then uses the sign of the second derivative to label each one a max or a min.",
      },
      {
        title: "A Two-Variable Terrain",
        file: "07_toy_terrain.py",
        text: "Moving up a dimension, f(x, y) = (x − 2)² − xy + (y − 3)² describes a surface, like the height of a landscape at each point. This section just builds a grid and draws the surface in 3D, showing a bowl shape with a single lowest point for the next methods to find.",
      },
      {
        title: "Gradient Descent in 2D",
        file: "08_gradient_descent_2d.py",
        text: "Gradient descent generalizes the first section to two variables: the gradient is a vector of partial derivatives pointing uphill, so stepping against it walks downhill. After 100 steps it settles near the bottom of the bowl at roughly (4.67, 5.33).",
      },
      {
        title: "Newton's Method in 2D",
        file: "09_newton_2d.py",
        text: "In two dimensions the curvature becomes a matrix, the Hessian, and instead of dividing by the second derivative we solve a small linear system. Because this surface is quadratic, Newton reaches the exact minimum, (14/3, 16/3), in a single step, where gradient descent needed a hundred to get close.",
      },
      {
        title: "Gauss–Newton",
        file: "10_gauss_newton.py",
        text: "The last section solves a different kind of problem: finding a point where two nonlinear equations (the Himmelblau pair) are both zero. Gauss–Newton approximates the curvature using only first derivatives (the Jacobian), which makes it a standard tool for least-squares fitting. Starting from the origin it arrives at (3, 2), where the residuals vanish.",
      },
    ],
  },
];
