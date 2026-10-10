# Package ownership and the single web build

**Updated:** 10 October 2026, following [the deployment decision](18-architecture-boundaries-and-deployment.md). The earlier engine extraction remains in place. Hosting now uses one `apps/web` application instead of two separately deployed frontends.

## What changed

- Public pages moved from `apps/site` to `apps/web` (`@evir/web`).
- Studio UI moved from `apps/editor` to `packages/studio` (`@evir/studio`). Web imports its explicit `./build` export and compiles it into `dist/editor/studio/`.
- Studio's independent hosting configs/environment file were removed. Its home link and the public launch links use the web route on the current origin.
- The web environment uses only `SITE_URL` for its full public address, plus optional public links. Its path is derived from that URL; Studio is always mounted beneath it at `/editor/studio/`.
- One GitHub-connected Cloudflare/Netlify project publishes `apps/web/dist`. GitHub Pages publishes this same output. Web/Studio validation and engine package validation remain separate jobs.

The five engine packages retain their own source, exports and versions. No core implementation moved into the frontend. The `.riv` schema/license stays in `packages/format/schema`; Python format research remains in `tools/riv.py`. See [engine contracts](../packages/README.md) and [Studio ownership](../packages/studio/README.md).

## Development

```sh
npm ci
npm run web:build
npm run web:serve
```

Open port 8787: `/` is the home, `/editor/` the landing, `/editor/studio/` the workspace. A prefixed `SITE_URL`, such as `https://mgregchi.github.io/Evir/`, mounts all three under `/Evir/`. The old `/studio/` landing redirects to `/editor/`.

| Build | Output | Purpose |
| --- | --- | --- |
| `npm run web:build` | `apps/web/dist` | The one hosted frontend, including Studio |
| `npm run runtime:build` | Each engine package's `dist`/npm archive | Independent engine package distribution |

The web build invokes the Studio package directly; it does not stage/copy a separate app's build output. Publishing web does not publish npm packages. Backend/GPU/native work remains outside this change.

## Hosting migration

Follow [the single-project GitHub hosting guide](20-github-connected-hosting.md). Update the provider's root/package/output paths and build command to `apps/web`, `apps/web/dist` and `web:build` as appropriate. Remove old Studio path proxies/routes after the combined artifact is deployed.

Before retiring a Studio domain, download projects from its origin and reopen them on the web origin. Browser storage is origin-specific; changing only the path on an unchanged origin retains it. No cloud account or deployment is modified by this repository migration.

## Verification commands

- `npm run test:frontend`: one-address configuration, prefixed routes, legacy site settings and obsolete Studio settings.
- `npm run test:web`: public pages, responsive/accessibility checks, same-origin Studio launch/open/export, redirects/404, and official-runtime showcase comparisons.
- `npm run test:editor`: model/compiler unit tests and browser authoring flows through the composed Studio route.
- `npm run validate:editor`: exported scenes checked against official Canvas2D/WebGL2 runtimes.
- `npm run test:runtime` and `npm run runtime:build`: core behavior, dependency boundaries and independent engine artifacts.

Browser oracle commands share port 8776 and run sequentially. Results are retained in the existing research result locations. These checks do not complete physical-device audits, controlled equivalent Editor scenes, GPU/native backends or broader Rive parity.
