// Equilibrium Daily static site builder.
// Reads notes.json and sections.json and writes plain HTML pages with math
// pre-rendered by KaTeX, so every page works without JavaScript.
//
// Usage (from the repository root):
//   npm install katex@0.16.11
//   node tools/build.js
//
// Output: index.html, archive.html, section.html, note.html, about.html,
// why.html, 404.html, notes/<id>.html, sections/<id>.html.
// Old links (note.html?id=<id>, section.html?s=<id>) keep working: those two
// pages forward to the static page and also list every note or section.

"use strict";

const fs = require("fs");
const path = require("path");
const katex = require("katex");

const ROOT = path.resolve(__dirname, "..");
const SITE = "https://equilibriumdaily.github.io";
const X_URL = "https://x.com/equilibriumdail";
const KATEX_CSS = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css";
const FONTS = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,400&display=swap";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];

const notes = JSON.parse(fs.readFileSync(path.join(ROOT, "notes.json"), "utf8"));
const sections = JSON.parse(fs.readFileSync(path.join(ROOT, "sections.json"), "utf8"));
const smap = {};
sections.forEach((s) => { smap[s.id] = s; });

// ---------- helpers ----------

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Escape text and render $...$ (inline) and $$...$$ (display) with KaTeX.
function rich(text) {
  const s = String(text == null ? "" : text);
  let out = "";
  let i = 0;
  while (i < s.length) {
    const j = s.indexOf("$", i);
    if (j < 0) { out += esc(s.slice(i)); break; }
    out += esc(s.slice(i, j));
    const display = s[j + 1] === "$";
    const open = display ? 2 : 1;
    const k = s.indexOf(display ? "$$" : "$", j + open);
    if (k < 0) { out += esc(s.slice(j)); break; }
    const tex = s.slice(j + open, k);
    out += katex.renderToString(tex, { displayMode: display, throwOnError: false, output: "htmlAndMathml" });
    i = k + open;
  }
  return out;
}

// Plain text version for meta descriptions.
function plain(text) {
  return String(text == null ? "" : text).replace(/\$\$?/g, "").replace(/\\[a-zA-Z]+/g, "").replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
}

function fmtDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!m) return esc(iso);
  return parseInt(m[3], 10) + " " + MONTHS[parseInt(m[2], 10) - 1] + " " + m[1];
}

function newestFirst(a, b) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return a.id < b.id ? 1 : -1;
}

function plural(n, word) { return n + " " + word + (n === 1 ? "" : "s"); }
function noteHref(id) { return "/notes/" + encodeURIComponent(id) + ".html"; }
function sectionHref(id) { return "/sections/" + encodeURIComponent(id) + ".html"; }
function sectionName(id) { return smap[id] ? smap[id].name : id; }
function asset(p) { return p.startsWith("/") || /^https?:/.test(p) ? p : "/" + p; }

function write(rel, html) {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

// ---------- page shell ----------

function shell(opts) {
  const title = opts.title ? esc(opts.title) + " | Equilibrium Daily" : "Equilibrium Daily";
  const desc = esc(opts.description || "One short note a day, each stating and proving one result in economics or finance. Notes are drafted by AI and reviewed before publication.");
  const cur = (name) => (opts.nav === name ? ' aria-current="page"' : "");
  let head = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc}">
`;
  if (opts.canonical) {
    head += `<link rel="canonical" href="${SITE}${opts.canonical}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(opts.title || "Equilibrium Daily")}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${SITE}${opts.canonical}">
<meta name="twitter:card" content="summary">
`;
  }
  if (opts.redirect) head += opts.redirect;
  head += `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
`;
  if (opts.math) head += `<link rel="stylesheet" href="${KATEX_CSS}">\n`;
  head += `<link rel="stylesheet" href="/style.css">
</head>
`;
  return head + `<body>
<header class="site">
  <div class="wrap bar">
    <a class="brand" href="/"><span class="mark" aria-hidden="true">=</span><span class="brand-name">Equilibrium Daily</span></a>
    <nav><a href="/archive.html"${cur("archive")}>Archive</a><a href="/section.html"${cur("sections")}>Sections</a><a href="/why.html"${cur("why")}>Why</a><a href="/about.html"${cur("about")}>About</a></nav>
  </div>
</header>
<main class="wrap">
${opts.body}
</main>
<footer class="site">
  <div class="wrap foot">
    <p>Notes are drafted by AI and reviewed before publication.</p>
    <p class="foot-links"><a href="/">Home</a><a href="/archive.html">Archive</a><a href="/section.html">Sections</a><a href="/why.html">Why</a><a href="/about.html">About</a><a href="${X_URL}" rel="noopener">Follow on X</a></p>
  </div>
</footer>
</body>
</html>
`;
}

// ---------- shared blocks ----------

function metaRow(n) {
  return `<div class="meta"><span class="num">No. ${esc(n.id)}</span><time datetime="${esc(n.date)}">${fmtDate(n.date)}</time><a class="tag" href="${sectionHref(n.section)}">${esc(sectionName(n.section))}</a></div>`;
}

function noteItem(n) {
  const preview = n.intuition ? n.intuition : n.statement;
  return `<li>${metaRow(n)}<a class="note-title" href="${noteHref(n.id)}">${esc(n.title)}</a><p class="note-intuition">${rich(preview)}</p></li>`;
}

function noteList(list) {
  if (!list.length) return '<p class="empty">No notes yet.</p>';
  return '<ul class="notes">' + list.map(noteItem).join("") + "</ul>";
}

function sectionList() {
  const counts = {};
  notes.forEach((n) => { counts[n.section] = (counts[n.section] || 0) + 1; });
  return '<ul class="sections">' + sections.map((s) => {
    const c = counts[s.id] || 0;
    return `<li${c ? "" : ' class="is-empty"'}><a class="card" href="${sectionHref(s.id)}"><span class="card-top"><span class="card-name">${esc(s.name)}</span><span class="count">${plural(c, "note")}</span></span><span class="section-desc">${esc(s.description)}</span></a></li>`;
  }).join("") + "</ul>";
}

const sorted = notes.slice().sort(newestFirst);
const oldestFirst = sorted.slice().reverse();

// ---------- home ----------

write("index.html", shell({
  math: true,
  body: `<section class="hero">
  <h1>One result a day in economics and finance</h1>
  <p class="lead">One short note a day, each stating and proving one result in economics or finance, drafted by an AI model and reviewed by a person before publication.</p>
</section>
<aside class="callout"><span class="callout-label">Why we publish outside journals</span><span>Academic publishing rewards names and networks more than findings. <a href="/why.html">Read the evidence &rarr;</a></span></aside>
<div class="section-head"><h2>Latest notes</h2><span class="label"><a href="/archive.html">All ${plural(notes.length, "note")} &rarr;</a></span></div>
${noteList(sorted.slice(0, 10))}
<div class="section-head" id="sections"><h2>Sections</h2><span class="label"><a href="/section.html">All sections</a></span></div>
${sectionList()}`,
}));

// ---------- archive ----------

write("archive.html", shell({
  title: "Archive",
  nav: "archive",
  math: true,
  body: `<h1>Archive</h1>
<p class="lead">Every note published so far, newest first.</p>
<div class="section-head"><h2>All notes</h2><span class="label">${plural(notes.length, "note")}</span></div>
${noteList(sorted)}`,
}));

// ---------- sections ----------

// section.html: list of sections; old links section.html?s=<id> are forwarded.
const sectionRedirect = `<script>
(function () {
  var s = new URLSearchParams(window.location.search).get("s");
  if (s && /^[a-z0-9-]+$/.test(s)) window.location.replace("/sections/" + s + ".html");
})();
</script>
`;
write("section.html", shell({
  title: "Sections",
  nav: "sections",
  redirect: sectionRedirect,
  body: `<h1>Sections</h1>
<p class="lead">Notes are grouped by field. Choose a section to see all its notes, newest first.</p>
${sectionList()}`,
}));

sections.forEach((s) => {
  const list = sorted.filter((n) => n.section === s.id);
  write("sections/" + s.id + ".html", shell({
    title: s.name,
    nav: "sections",
    math: true,
    description: s.description,
    canonical: sectionHref(s.id),
    body: `<div class="crumbs"><a href="/">Home</a><span>/</span><a href="/section.html">Sections</a></div>
<h1>${esc(s.name)}</h1>
<p class="lead">${esc(s.description)}</p>
<div class="section-head"><h2>Notes</h2><span class="label">${plural(list.length, "note")}</span></div>
${noteList(list)}`,
  }));
});

// ---------- notes ----------

oldestFirst.forEach((n, idx) => {
  const prev = idx > 0 ? oldestFirst[idx - 1] : null;
  const next = idx < oldestFirst.length - 1 ? oldestFirst[idx + 1] : null;
  let h = `<div class="crumbs"><a href="/">Home</a><span>/</span><a href="${sectionHref(n.section)}">${esc(sectionName(n.section))}</a></div>
<div class="note-head">${metaRow(n)}<h1>${esc(n.title)}</h1></div>
`;
  if (n.corrected) h += `<div class="notice"><strong>Corrected:</strong> ${esc(n.corrected)}</div>\n`;
  if (n.intuition) h += `<p class="intuition">${rich(n.intuition)}</p>\n`;
  h += `<div class="result"><span class="label">Result</span><p>${rich(n.statement)}</p></div>\n`;
  h += `<h2>Summary</h2>\n<p>${rich(n.summary)}</p>\n`;

  // Materials: PDF, discussion and error reporting.
  const pdf = n.pdf ? asset(n.pdf) : "";
  const items = [];
  if (pdf) {
    items.push(`<li><span class="mat-name">Full note (PDF)</span><span class="mat-links"><a class="button primary" href="${esc(pdf)}" download>Download</a><a class="button" href="${esc(pdf)}" target="_blank" rel="noopener">Open</a></span></li>`);
  }
  if (n.x_url) {
    items.push(`<li><span class="mat-name">Discussion</span><span class="mat-links"><a class="button" href="${esc(n.x_url)}" rel="noopener">Thread on X</a></span></li>`);
  }
  items.push(`<li><span class="mat-name">Found an error?</span><span class="mat-links"><a class="button" href="${X_URL}" rel="noopener">Write on X</a></span></li>`);
  h += `<h2>Materials</h2>\n<ul class="materials">${items.join("")}</ul>\n`;
  if (pdf) h += `<iframe class="pdf-frame" src="${esc(pdf)}" title="PDF of note ${esc(n.id)}"></iframe>\n`;

  if (n.sources && n.sources.length) {
    h += `<h2>Sources</h2>\n<ol class="sources">${n.sources.map((s) => "<li>" + esc(s) + "</li>").join("")}</ol>\n`;
  }
  if (prev || next) {
    h += '<nav class="prevnext" aria-label="More notes">';
    if (prev) h += `<a class="prev" href="${noteHref(prev.id)}"><span class="label">&larr; Previous &middot; No. ${esc(prev.id)}</span>${esc(prev.title)}</a>`;
    if (next) h += `<a class="next" href="${noteHref(next.id)}"><span class="label">Next &middot; No. ${esc(next.id)} &rarr;</span>${esc(next.title)}</a>`;
    h += "</nav>";
  }
  write("notes/" + n.id + ".html", shell({
    title: n.title,
    math: true,
    description: plain(n.intuition || n.statement).slice(0, 300),
    canonical: noteHref(n.id),
    body: h,
  }));
});

// note.html: old links note.html?id=<id> are forwarded; without JavaScript the
// page lists every note with a direct link.
const noteRedirect = `<script>
(function () {
  var id = new URLSearchParams(window.location.search).get("id");
  if (id && /^[A-Za-z0-9-]+$/.test(id)) window.location.replace("/notes/" + id + ".html");
})();
</script>
`;
write("note.html", shell({
  title: "Notes",
  redirect: noteRedirect,
  math: true,
  body: `<h1>Notes</h1>
<p class="lead">Each note now has its own page. If you followed a link to a specific note, choose it below.</p>
${noteList(sorted)}`,
}));

// ---------- static pages ----------

write("about.html", shell({ title: "About", nav: "about", body: fs.readFileSync(path.join(__dirname, "about.body.html"), "utf8").trim() }));
write("why.html", shell({ title: "Why", nav: "why", body: fs.readFileSync(path.join(__dirname, "why.body.html"), "utf8").trim() }));
write("404.html", shell({ title: "Page not found", body: '<h1>Page not found</h1>\n<p>The page you requested does not exist. <a href="/">Go to the home page</a> or browse the <a href="/archive.html">archive</a>.</p>' }));

console.log("Built " + notes.length + " notes and " + sections.length + " sections.");
