# Contributing to Evir

Start with the [current editor subset](docs/13-editor-milestone-acceptance.md), [roadmap](site/content.mjs) and [open issues](https://github.com/Mgregchi/Evir/issues). A reproducible bug, clearer documentation, an editing-workflow report or a focused rendering experiment is useful. Discuss substantial architecture changes in an issue before implementing them.

## Local setup

Use Node.js 24, Python 3 and Git. Install the pinned dependencies and a browser:

```sh
git clone https://github.com/Mgregchi/Evir.git
cd Evir
npm ci
npx playwright install chromium
npm run site:build
npm run site:serve
```

The site is at `http://127.0.0.1:8787/`; Studio is at `/editor/`. Browser tools accept `CHROMIUM_PATH`; older research scripts default to `/usr/bin/chromium`, so set that variable to your installed Chromium executable when needed. See [public configuration and hosting](site/README.md), [the editor guide](editor/README.md) and [research reproduction](research/README.md).

## Changes and checks

Keep each pull request focused on a concrete task. Explain the previous behavior, resulting behavior, relevant validation and remaining limits. A public-site change should pass `npm run site:build` and `npm run test:site`. An editor change should pass `npm run test:editor` and `npm run validate:editor`; run `npm test` for Python codec changes. Research results need their fixture/source hashes, runtime versions, measurement method and actual hardware provenance. Cloud software rendering does not establish mobile/GPU performance.

Do not commit `node_modules`, local `.env`, generated `site/dist`, credentials or privately supplied project files. Public examples should be original or carry documented redistribution terms. Existing Evir brand artwork should retain its appearance and provenance; do not substitute newly drawn versions. The project code and original showcase assets are MIT licensed; third-party material retains its own terms.

For bugs, include the editing task, reproduction steps, expected and actual behavior, browser/OS, and a small shareable project when useful. For feature ideas, explain the workflow and success criteria. Be constructive and distinguish observations from expectations. Feedback drafted on the community page is posted only after you review and submit it in the configured destination.
