# Independent applications and runtime packages

Implemented on 9 October 2026 following [the boundary decision](18-architecture-boundaries-and-deployment.md). This is repository/deployment separation, not a claim of complete Rive compatibility or GPU/mobile performance.

## Research before implementation

The existing source and build/test scripts showed two coupling problems: the public build copied editor modules, and project validation imported the motion evaluator while the evaluator imported the model. The migration replaces copied source with explicit package exports and moves feature validation into the model, removing that dependency cycle.

Primary references consulted:

- [npm workspaces](https://docs.npmjs.com/cli/v11/using-npm/workspaces): local package linking and workspace build commands.
- [Node package exports](https://nodejs.org/api/packages.html): explicit package/subpath entry points.
- [esbuild API](https://esbuild.github.io/api/): standalone bundles and application-specific ESM builds.
- [Cloudflare static assets configuration](https://developers.cloudflare.com/workers/static-assets/configuration/): separate static asset directories and missing-page behavior.
- [GitHub configure-pages action contract](https://github.com/actions/configure-pages/blob/v5/action.yml): origin/base-path metadata for project-site builds.

Independent releases do not require separate repositories. This monorepo now has one owner for each shared implementation, separate application artifacts, and versioned package manifests. There is no backend service to relocate yet.

## Where code lives

```text
apps/site/                  public pages, /product and /editor landing
apps/editor/                full authoring application
assets/brand/               unchanged supplied artwork renditions
packages/project-model/     editable project and playback validation
packages/runtime/           loading, time, animation and state machines
packages/renderer-canvas/   Canvas2D drawing
packages/authoring/         editing operations and transaction history
packages/format/            explicit .riv subset compiler and schema
tools/                     research codec, validation and build utilities
research/                  fixtures, sources and measurement evidence
```

The reusable engine is primarily `packages/runtime/`, with its project contract and renderer in adjacent packages. Official Rive runtimes remain research/test oracles, not the engine embedded in Evir applications. No GPU renderer, cloud backend or AI service is implied by this extraction.

See [the package API and release guide](../packages/README.md). Playback accepts editable projects or a sanitized `evir-runtime` JSON snapshot. Cameras, locks, hidden-layer controls and interaction-graph positions do not enter that snapshot. The snapshot is a playback contract for the tested subset, not a finalized optimized `.evir` binary format. The compiler's pinned schema and upstream license now live in `packages/format/schema/`; the Python structural reader/writer remains `tools/riv.py`.

## Development and hosting

For hosting that automatically builds from GitHub, use [the Cloudflare and Netlify connection guide](20-github-connected-hosting.md). This section covers local development and output ownership; the connection guide lists dashboard fields, build environments, previews and custom domains.

Use Node 24, Python 3 and the pinned lockfile:

```sh
npm ci
npm run site:build
npm run editor:build
npm run runtime:build
```

Run `npm run site:serve` and `npm run editor:serve` in separate terminals. Their defaults are ports 8787 and 8788 respectively. Builds only replace their own output directory. No app build copies another app or writes package release artifacts.

| Surface | Build | Deploy directory | Public configuration |
| --- | --- | --- | --- |
| Public site | `npm run site:build` | `apps/site/dist` | `PUBLIC_SITE_URL`, `PUBLIC_BASE_PATH`, `PUBLIC_EDITOR_URL`, community/feedback/social URLs |
| Full editor | `npm run editor:build` | `apps/editor/dist` | `EDITOR_BASE_PATH`, `EDITOR_PUBLIC_SITE_URL` |
| Shared packages | `npm run runtime:build` | Each package's own `dist` and npm archive | Versioned API, no app environment variables |

Populate [site settings](../apps/site/.env.example) and [editor settings](../apps/editor/.env.example) separately. For a domain/subdomain installation, set the site's `PUBLIC_EDITOR_URL` to the editor application's HTTPS origin, and the editor's `EDITOR_PUBLIC_SITE_URL` to the public site's HTTPS origin. `/product` describes the product; `/editor` is the public editor landing; its launch buttons open the configured application. The old public `/studio/` URL redirects to `/editor/`.

Frontend values are public build-time settings, never secrets. The editor's setting controls its home link and is not an account/API credential. Custom URLs remain configurable rather than hardcoded to a proposed domain.

Cloudflare Pages can build each application from the repository root using the commands/directories above, as two projects. Workers static-assets configurations are provided in each application directory; after a build, an authorized operator can use `npx wrangler deploy --config apps/site/wrangler.jsonc` or the editor equivalent. Existing hosting integrations need their dashboard build/output settings updated. No Cloudflare account, domain or deployment was provisioned by this migration.

The existing GitHub Pages workflow's automatic main trigger is preserved; its invalid absolute `/site` upload is replaced with an actual site build and `apps/site/dist` artifact. Pages metadata supplies the site's origin/base path unless explicitly overridden, including the existing `/Evir/` project path. Configure `PUBLIC_EDITOR_URL` to the separately hosted editor before publishing; the local-development default is not a production destination. Relevant PRs run public-site validation. Runtime/editor validation has separate path filters and artifacts; a site-only content change does not invoke the editor/runtime workflow. npm publication remains an explicit release operation, not an automatic workflow side effect.

**Persistence migration:** editor browser storage is scoped to its origin. Before switching an existing hosted editor to a new subdomain, download/save projects from the old application and reopen them in the new one. This change does not automatically move local storage across origins. Keep the old application accessible during that transition if users already rely on it.

## Verification

The migration's local checks completed successfully:

- 6 runtime contract/dependency-boundary tests and 20 editor unit tests.
- Both existing editor browser authoring flows against the separate editor build.
- 22 public-page/configuration cases: 11 pages at root and under a prefix, widths 1440/390/320, automated WCAG A/AA checks, feedback/preview controls and no-script behavior.
- Real site-to-editor navigation across separate local origins, project loading and byte-identical `.riv` export; prefixed editor hosting and the legacy landing redirect.
- 40 editor export pixel/interaction checks and 30 showcase pixel comparisons across official Canvas2D and WebGL2 runtimes, version 2.44.0.
- 22 Python codec tests after the schema relocation.
- Five built npm archives installed offline into a fresh consumer outside this repository: the runtime plays Milo, strips editor state and the compiler reproduces the committed export bytes.
- Fresh `npm ci` followed by all builds and runtime/codec tests; both standalone servers return their expected page and JavaScript assets, with missing routes returning 404. A site rebuild leaves editor and all five package release artifacts byte-identical.

Run `npm run test:runtime`, `npm run test:editor`, `npm run validate:editor`, `npm run test:site` and `npm test` to reproduce the relevant checks. Browser research commands share port 8776 and must run sequentially. Site evidence is retained in `research/results/public-site/`; the existing editor evidence remains in its research results directory. CI/provider execution is a separate check from these local results.

Physical-device audits, controlled equivalent Editor scenes, semantic `.riv` import, GPU/native backends and broader feature parity remain unchanged future work. This organization makes that work independently maintainable; it does not replace the research gates.
