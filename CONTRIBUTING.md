# Contributing to Evir

Start with the [current editor subset](docs/13-editor-milestone-acceptance.md), [roadmap](apps/site/content.mjs) and [open issues](https://github.com/Mgregchi/Evir/issues). A reproducible bug, clearer documentation, an editing-workflow report or a focused rendering experiment is useful. Discuss substantial architecture changes in an issue before implementing them.

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

The site defaults to port 8787; `/editor/` is its landing page. In another terminal, run `npm run editor:build` followed by `npm run editor:serve` for the full application on port 8788. Browser tools accept `CHROMIUM_PATH`; set it to an installed Chromium executable when needed. See [public configuration and hosting](apps/site/README.md), [the editor guide](apps/editor/README.md), [shared package contracts](packages/README.md) and [research reproduction](research/README.md).

## Changes and checks

Keep each pull request focused on a concrete task. Explain the previous behavior, resulting behavior, relevant validation and remaining limits. A public-site change should pass `npm run site:build` and `npm run test:site`. An editor change should pass `npm run test:editor` and `npm run validate:editor`; shared engine changes additionally require `npm run test:runtime` and `npm run runtime:build`. Run `npm test` for Python codec changes. Applications import shared packages rather than copying their source; edit those implementations in `packages/`. Research results need their fixture/source hashes, runtime versions, measurement method and actual hardware provenance. Cloud software rendering does not establish mobile/GPU performance.

Do not commit `node_modules`, local `.env`, generated `apps/*/dist` or `packages/*/dist`, credentials or privately supplied project files. Public examples should be original or carry documented redistribution terms. Existing Evir brand artwork in `assets/brand` should retain its appearance and provenance; do not substitute newly drawn versions. The project code and original showcase assets are MIT licensed; third-party material retains its own terms.

For bugs, include the editing task, reproduction steps, expected and actual behavior, browser/OS, and a small shareable project when useful. For feature ideas, explain the workflow and success criteria. Be constructive and distinguish observations from expectations. Feedback drafted on the community page is posted only after you review and submit it in the configured destination.
