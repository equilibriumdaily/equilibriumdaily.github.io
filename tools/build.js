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
//
// Search and discovery files, also generated here:
//   sitemap.xml, robots.txt  for search engines;
//   feed.xml                 Atom feed of all notes;
//   llms.txt, llms-full.txt  site guide and full text for AI systems;
//   notes/<id>.md            each note as Markdown with LaTeX;
//   favicon.svg, .nojekyll   site icon; serve files as they are;
//   <INDEXNOW_KEY>.txt       key file for IndexNow (Bing and others).
// Every note page carries schema.org JSON-LD (ScholarlyArticle and
// BreadcrumbList), Open Graph tags and Google Scholar citation_* tags.

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
const SITE_NAME = "Equilibrium Daily";
const SITE_DESC = "One short note a day, each stating and proving one result in economics or finance. Notes are drafted by AI and reviewed before publication.";
const X_HANDLE = "@equilibriumdail";
// Public by design: IndexNow verifies ownership through a key file at the site root.
const INDEXNOW_KEY = "9a64fd239f591f2b6ac053b719d3f040";

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

// Plain text version for meta descriptions, feeds and structured data: math
// is kept readable (\delta_\beta becomes delta_beta, \le becomes <=).
const TEX_WORDS = {
  in: " in ", notin: " not in ", infty: "infinity", le: "<=", leq: "<=", ge: ">=", geq: ">=", neq: "!=", ne: "!=",
  to: "->", rightarrow: "->", mapsto: "->", cdot: "*", times: "x", ldots: "...", cdots: "...", dots: "...",
  approx: "~", sim: "~", lim: "lim", log: "log", exp: "exp", max: "max", min: "min", sup: "sup", inf: "inf",
  sum: "sum", int: "integral", prod: "product", sqrt: "sqrt", partial: "d", downarrow: " decreasing to ",
  uparrow: " increasing to ", mid: "|", quad: " ", qquad: " ", left: "", right: "", big: "", Big: "",
};
function plain(text) {
  let s = String(text == null ? "" : text);
  s = s.replace(/\\[{]/g, "\u0001").replace(/\\[}]/g, "\u0002");
  for (let k = 0; k < 3; k++) s = s.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, "($1)/($2)");
  s = s.replace(/\\(?:mathrm|mathbf|mathbb|mathcal|text|operatorname)\{([^{}]*)\}/g, "$1");
  s = s.replace(/\\([a-zA-Z]+)/g, (m, w) => (w in TEX_WORDS ? TEX_WORDS[w] : w));
  s = s.replace(/\\[,;:! ]/g, " ").replace(/\$\$?/g, "").replace(/[{}]/g, "");
  s = s.replace(/\u0001/g, "{").replace(/\u0002/g, "}");
  return s.replace(/\s+/g, " ").replace(/\( /g, "(").replace(/ \)/g, ")").trim();
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

// Shorten plain text to at most max characters at a word boundary.
function clip(text, max) {
  const s = String(text || "");
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.]+$/, "") + "…";
}

// JSON-LD block; "<" is escaped so the JSON cannot close the script element.
function jsonld(obj) {
  return '<script type="application/ld+json">' + JSON.stringify(obj).replace(/</g, "\\u003c") + "</script>\n";
}

function xmlEsc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const PUBLISHER = { "@type": "Organization", "name": SITE_NAME, "url": SITE + "/", "sameAs": [X_URL] };

function breadcrumbs(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((it, i) => ({ "@type": "ListItem", "position": i + 1, "name": it[0], "item": SITE + it[1] })),
  };
}
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
  const title = opts.title ? esc(opts.title) + " | " + SITE_NAME : SITE_NAME + ": one result a day in economics and finance";
  const full = opts.description || SITE_DESC;
  const desc = esc(clip(full, 160));
  const ogDesc = esc(clip(full, 300));
  const cur = (name) => (opts.nav === name ? ' aria-current="page"' : "");
  let head = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc}">
`;
  head += opts.noindex
    ? `<meta name="robots" content="noindex, follow">\n`
    : `<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">\n`;
  if (opts.canonical) {
    head += `<link rel="canonical" href="${SITE}${opts.canonical}">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:type" content="${opts.ogType || "website"}">
<meta property="og:locale" content="en_US">
<meta property="og:title" content="${esc(opts.title || SITE_NAME)}">
<meta property="og:description" content="${ogDesc}">
<meta property="og:url" content="${SITE}${opts.canonical}">
<meta name="twitter:card" content="summary">
<meta name="twitter:site" content="${X_HANDLE}">
<meta name="twitter:title" content="${esc(opts.title || SITE_NAME)}">
<meta name="twitter:description" content="${ogDesc}">
`;
  }
  if (opts.extraHead) head += opts.extraHead;
  head += `<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="alternate" type="application/atom+xml" title="${SITE_NAME}" href="${SITE}/feed.xml">
`;
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
  canonical: "/",
  extraHead: jsonld({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "@id": SITE + "/#website", "name": SITE_NAME, "url": SITE + "/", "description": SITE_DESC, "inLanguage": "en", "publisher": { "@id": SITE + "/#org" } },
      Object.assign({ "@id": SITE + "/#org", "description": SITE_DESC }, PUBLISHER),
    ],
  }),
  body:`<section class="hero">
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
  canonical: "/archive.html",
  description: "Every Equilibrium Daily note, newest first: " + plural(notes.length, "result") + " in economics and finance, each stated, proved and published with a PDF.",
  extraHead: jsonld({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "Archive",
    "url": SITE + "/archive.html",
    "isPartOf": { "@type": "WebSite", "name": SITE_NAME, "url": SITE + "/" },
    "mainEntity": { "@type": "ItemList", "itemListElement": sorted.map((n, i) => ({ "@type": "ListItem", "position": i + 1, "url": SITE + noteHref(n.id), "name": n.title })) },
  }),
  body:`<h1>Archive</h1>
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
  canonical: "/section.html",
  description: "Equilibrium Daily notes grouped by field: " + sections.map((s) => s.name).join(", ") + ".",
  body:`<h1>Sections</h1>
<p class="lead">Notes are grouped by field. Choose a section to see all its notes, newest first.</p>
${sectionList()}`,
}));

sections.forEach((s) => {
  const list = sorted.filter((n) => n.section === s.id);
  write("sections/" + s.id + ".html", shell({
    title: s.name,
    nav: "sections",
    math: true,
    description: s.name + " notes on Equilibrium Daily. " + s.description,
    canonical: sectionHref(s.id),
    noindex: list.length === 0,
    extraHead: jsonld({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": s.name,
      "description": s.description,
      "url": SITE + sectionHref(s.id),
      "isPartOf": { "@type": "WebSite", "name": SITE_NAME, "url": SITE + "/" },
      "mainEntity": { "@type": "ItemList", "itemListElement": list.map((n, i) => ({ "@type": "ListItem", "position": i + 1, "url": SITE + noteHref(n.id), "name": n.title })) },
    }) + jsonld(breadcrumbs([["Home", "/"], ["Sections", "/section.html"], [s.name, sectionHref(s.id)]])),
    body:`<div class="crumbs"><a href="/">Home</a><span>/</span><a href="/section.html">Sections</a></div>
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
  if (pdf) h += `<iframe class="pdf-frame" src="${esc(pdf)}" title="PDF of note ${esc(n.id)}" loading="lazy"></iframe>\n`;

  if (n.sources && n.sources.length) {
    h += `<h2>Sources</h2>\n<ol class="sources">${n.sources.map((s) => "<li>" + esc(s) + "</li>").join("")}</ol>\n`;
  }
  if (prev || next) {
    h += '<nav class="prevnext" aria-label="More notes">';
    if (prev) h += `<a class="prev" href="${noteHref(prev.id)}"><span class="label">&larr; Previous &middot; No. ${esc(prev.id)}</span>${esc(prev.title)}</a>`;
    if (next) h += `<a class="next" href="${noteHref(next.id)}"><span class="label">Next &middot; No. ${esc(next.id)} &rarr;</span>${esc(next.title)}</a>`;
    h += "</nav>";
  }
  const url = SITE + noteHref(n.id);
  const pdfUrl = pdf ? SITE + pdf : "";
  const secName = sectionName(n.section);
  const article = {
    "@context": "https://schema.org",
    "@type": "ScholarlyArticle",
    "@id": url + "#article",
    "headline": clip(n.title, 110),
    "name": n.title,
    "description": plain(n.intuition || n.statement),
    "abstract": plain(n.statement),
    "url": url,
    "mainEntityOfPage": url,
    "datePublished": n.date,
    "dateModified": n.date,
    "inLanguage": "en",
    "isAccessibleForFree": true,
    "articleSection": secName,
    "about": secName,
    "identifier": "Equilibrium Daily No. " + n.id,
    "author": PUBLISHER,
    "publisher": PUBLISHER,
    "isPartOf": { "@type": "WebSite", "name": SITE_NAME, "url": SITE + "/" },
  };
  if (pdfUrl) article.encoding = { "@type": "MediaObject", "contentUrl": pdfUrl, "encodingFormat": "application/pdf" };
  if (n.sources && n.sources.length) article.citation = n.sources.map((s) => ({ "@type": "CreativeWork", "name": s }));
  let extra = jsonld(article) + jsonld(breadcrumbs([["Home", "/"], [secName, sectionHref(n.section)], [n.title, noteHref(n.id)]]));
  // Google Scholar (Highwire Press) tags.
  extra += `<meta name="citation_title" content="${esc(n.title)}">
<meta name="citation_author" content="${SITE_NAME}">
<meta name="citation_publication_date" content="${esc(n.date.replace(/-/g, "/"))}">
<meta name="citation_online_date" content="${esc(n.date.replace(/-/g, "/"))}">
<meta name="citation_publisher" content="${SITE_NAME}">
<meta name="citation_technical_report_number" content="No. ${esc(n.id)}">
<meta name="citation_abstract_html_url" content="${url}">
<meta name="citation_language" content="en">
`;
  if (pdfUrl) extra += `<meta name="citation_pdf_url" content="${pdfUrl}">\n`;
  extra += `<meta property="article:published_time" content="${esc(n.date)}">
<meta property="article:section" content="${esc(secName)}">
<link rel="alternate" type="text/markdown" title="Markdown" href="${SITE}/notes/${encodeURIComponent(n.id)}.md">
`;
  write("notes/" + n.id + ".html", shell({
    title: n.title,
    math: true,
    description: plain(n.intuition || n.statement),
    canonical: noteHref(n.id),
    ogType: "article",
    extraHead: extra,
    body: h,
  }));
  write("notes/" + n.id + ".md", noteMarkdown(n));
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
  noindex: true,
  body: `<h1>Notes</h1>
<p class="lead">Each note now has its own page. If you followed a link to a specific note, choose it below.</p>
${noteList(sorted)}`,
}));

// ---------- static pages ----------

write("about.html", shell({
  title: "About",
  nav: "about",
  canonical: "/about.html",
  description: "How Equilibrium Daily works: one note a day stating and proving one result in economics or finance, drafted by an AI model, checked, and reviewed by a person before publication.",
  body: fs.readFileSync(path.join(__dirname, "about.body.html"), "utf8").trim(),
}));
write("why.html", shell({
  title: "Why we publish outside journals",
  nav: "why",
  canonical: "/why.html",
  ogType: "article",
  description: "Evidence from controlled experiments and journal data that author names and networks weigh heavily on academic publishing, and why Equilibrium Daily publishes every result openly with its full proof.",
  body: fs.readFileSync(path.join(__dirname, "why.body.html"), "utf8").trim(),
}));
write("404.html", shell({ title: "Page not found", noindex: true, body: '<h1>Page not found</h1>\n<p>The page you requested does not exist. <a href="/">Go to the home page</a> or browse the <a href="/archive.html">archive</a>.</p>' }));

// ---------- search and discovery files ----------

function noteMarkdown(n) {
  let md = `# ${n.title}\n\n`;
  md += `Equilibrium Daily, No. ${n.id}, ${fmtDate(n.date)}. Section: ${sectionName(n.section)}.\n\n`;
  md += `- Page: ${SITE}${noteHref(n.id)}\n`;
  if (n.pdf) md += `- Full note with proof (PDF): ${SITE}${asset(n.pdf)}\n`;
  md += `- Drafted by an AI model and reviewed by a person before publication.\n\n`;
  if (n.corrected) md += `**Corrected:** ${n.corrected}\n\n`;
  if (n.intuition) md += `## Intuition\n\n${n.intuition}\n\n`;
  md += `## Result\n\n${n.statement}\n\n## Summary\n\n${n.summary}\n`;
  if (n.sources && n.sources.length) md += `\n## Sources\n\n` + n.sources.map((s, i) => `${i + 1}. ${s}`).join("\n") + "\n";
  return md;
}

const staticPages = [["/", sorted.length ? sorted[0].date : ""], ["/archive.html", sorted.length ? sorted[0].date : ""], ["/section.html", ""], ["/about.html", ""], ["/why.html", ""]];
let sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
staticPages.forEach(([p, d]) => { sm += `  <url><loc>${SITE}${p}</loc>${d ? `<lastmod>${d}</lastmod>` : ""}</url>\n`; });
sections.forEach((s) => {
  const list = sorted.filter((n) => n.section === s.id);
  if (list.length) sm += `  <url><loc>${SITE}${sectionHref(s.id)}</loc><lastmod>${list[0].date}</lastmod></url>\n`;
});
sorted.forEach((n) => { sm += `  <url><loc>${SITE}${noteHref(n.id)}</loc><lastmod>${n.date}</lastmod></url>\n`; });
sm += "</urlset>\n";
write("sitemap.xml", sm);

write("robots.txt", `# Equilibrium Daily: all content is open to search engines and AI systems.
User-agent: *
Allow: /

Sitemap: ${SITE}/sitemap.xml
`);

const updated = (sorted.length ? sorted[0].date : "2026-01-01") + "T00:00:00Z";
let feed = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${SITE_NAME}</title>
  <subtitle>${xmlEsc(SITE_DESC)}</subtitle>
  <link href="${SITE}/feed.xml" rel="self"/>
  <link href="${SITE}/"/>
  <id>${SITE}/</id>
  <updated>${updated}</updated>
  <author><name>${SITE_NAME}</name><uri>${SITE}/</uri></author>
`;
sorted.forEach((n) => {
  feed += `  <entry>
    <title>${xmlEsc(n.title)}</title>
    <link href="${SITE}${noteHref(n.id)}"/>
    <id>${SITE}${noteHref(n.id)}</id>
    <published>${n.date}T00:00:00Z</published>
    <updated>${n.date}T00:00:00Z</updated>
    <category term="${xmlEsc(sectionName(n.section))}"/>
    <summary>${xmlEsc(plain(n.intuition || n.statement))}</summary>
  </entry>
`;
});
feed += "</feed>\n";
write("feed.xml", feed);

let llms = `# ${SITE_NAME}

> ${SITE_DESC} Each note states one result, proves it in a PDF, and lists its sources. Everything is free to read, cite and reuse.

Notes are drafted by an AI model, checked, and reviewed by a person before publication. Errors are reported on X (${X_URL}). The full text of every note, in Markdown with LaTeX, is at ${SITE}/llms-full.txt; each note is also available as Markdown at /notes/<id>.md.

## About

- [About](${SITE}/about.html): how notes are produced and corrected
- [Why](${SITE}/why.html): evidence on gatekeeping in academic publishing
- [Archive](${SITE}/archive.html): all notes, newest first
- [Atom feed](${SITE}/feed.xml)

`;
sections.forEach((s) => {
  const list = sorted.filter((n) => n.section === s.id);
  if (!list.length) return;
  llms += `## ${s.name}\n\n`;
  list.forEach((n) => { llms += `- [${n.title}](${SITE}/notes/${n.id}.md): ${clip(plain(n.intuition || n.statement), 220)}\n`; });
  llms += "\n";
});
write("llms.txt", llms);
write("llms-full.txt", `# ${SITE_NAME}: full text of all notes\n\n> ${SITE_DESC}\n\n` + sorted.map((n) => noteMarkdown(n)).join("\n---\n\n"));

write("favicon.svg", '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#1f5f8b"/><rect x="16" y="22" width="32" height="6" rx="3" fill="#fff"/><rect x="16" y="36" width="32" height="6" rx="3" fill="#fff"/></svg>\n');
write(".nojekyll", "");
write(INDEXNOW_KEY + ".txt", INDEXNOW_KEY + "\n");

console.log("Built " + notes.length + " notes and " + sections.length + " sections.");
