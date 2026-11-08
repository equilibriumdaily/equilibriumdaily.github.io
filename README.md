# Equilibrium Daily

Source of the static site at https://equilibriumdaily.github.io

One short note a day, each stating and proving one result in economics or finance, with a PDF. Notes are drafted by an AI model and reviewed by a person before publication.

## Structure

- `notes.json`: all notes (id, date, section, title, intuition, statement, summary, pdf, sources, x_url, optional corrected).
- `sections.json`: section ids, names and descriptions.
- `pdf/`: note PDFs, named by note id (e.g. `pdf/0001.pdf`).
- `tools/build.js`: generates every HTML page from the JSON files, with math pre-rendered by KaTeX, so pages work without JavaScript.
- `tools/about.body.html`, `tools/why.body.html`: text of the About and Why pages.
- `style.css`: shared styles.

Generated pages: `index.html`, `archive.html`, `section.html`, `note.html`, `about.html`, `why.html`, `404.html`, `notes/<id>.html`, `sections/<id>.html`. Older links of the form `note.html?id=<id>` and `section.html?s=<id>` forward to the static pages.

## Publishing a note

1. Add the PDF to `pdf/` and an entry to `notes.json`.
2. Run `npm install katex@0.16.11` once, then `node tools/build.js`.
3. Commit the JSON, the PDF and the regenerated HTML.

## Reporting errors

Write on X: https://x.com/equilibriumdail
