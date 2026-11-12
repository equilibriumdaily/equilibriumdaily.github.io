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

1. Create a branch named `release-<id>` (for example `release-0014`) from `main`.
2. On that branch, add the PDF to `pdf/` and an entry to `notes.json`. Regenerated HTML is optional: the release rebuilds every page.
3. The `scheduled-release` workflow runs daily at 01:37 UTC. It publishes the oldest `release-*` branch as a single commit on `main`, then deletes the branch. One note is published per day.

To rebuild locally: `npm install katex@0.16.11 @resvg/resvg-js@2.6.2`, then `node tools/build.js`.

## Search and discovery

`tools/build.js` also generates, on every release:

- `sitemap.xml`, `robots.txt` and an Atom feed (`feed.xml`) with the full text of each note;
- `llms.txt` and `llms-full.txt` for AI systems, and a Markdown copy of each note (`notes/<id>.md`);
- a 1200x630 social preview card for each note and for the site (`og/<id>.png`, `og/site.png`), drawn with `@resvg/resvg-js` when it is installed;
- `favicon.svg`, `.nojekyll` and the IndexNow key file.

Note pages carry schema.org JSON-LD (ScholarlyArticle, BreadcrumbList), Open Graph and X card tags with the preview image, Google Scholar `citation_*` tags, and links to related notes in the same section. After each release the workflow notifies IndexNow (Bing and others) of the changed pages.

## Reporting errors

Write on X: https://x.com/equilibriumdail
