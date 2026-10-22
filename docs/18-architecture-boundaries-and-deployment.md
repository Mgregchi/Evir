# Product boundaries and deployment architecture

**Updated decision:** 10 October 2026. One web frontend is hosted; Studio and engine implementations remain individual packages. This supersedes the earlier two-frontend deployment arrangement, while retaining its ownership/API separation.

## Surfaces and ownership

| URL/surface | Owner | Delivery |
| --- | --- | --- |
| `/`, `/product/`, community and other public pages | `apps/web` | One web deployment |
| `/editor/` landing | `apps/web` | Same web deployment |
| `/editor/studio/` workspace | `packages/studio` (`@evir/studio`) | Imported and built into web |
| Project model, authoring, runtime, renderer, `.riv` compiler | Individual engine packages | Bundled by consumers; independent package releases |
| Compatibility studies, device harnesses and evidence | `tools/`, `research/` | Development/research infrastructure |

`apps/web` owns hosting and frontend environment settings. It imports the Studio package's build interface to produce the route; it does not copy Studio source into a second implementation. Public pages and Studio can be maintained/tested separately while sharing one deployed artifact.

```text
apps/web/                  # public pages and web composition/hosting
packages/service/          # Worker/D1 accounts and authenticated MCP APIs
packages/studio/           # Studio browser UI, styles, template and build interface
packages/project-model/    # validated editable/runtime project contracts
packages/runtime/          # loading, motion and state machines
packages/renderer-canvas/  # Canvas2D backend
packages/authoring/        # editing operations and history
packages/format/           # tested .riv subset compiler and schema
assets/brand/              # supplied artwork renditions
research/
tools/
```

The web build writes only `apps/web/dist`, including `editor/studio/`. Runtime package builds/releases remain separate. Changing public presentation does not alter engine implementation or require publishing a new engine version; it may rebuild the web bundle that consumes those packages.

## Engine boundary

`packages/runtime` is Evir's playback core, with the model and Canvas2D adapter alongside it. Official `@rive-app/canvas` and `@rive-app/webgl2` are research/test oracles, not the engine embedded in the frontend. The `.riv` compiler covers a declared subset. GPU/native backends, broader import/parity and physical-device performance remain future work. The independent `packages/service` now implements Cloudflare Worker/D1 passkey accounts and an account-only authenticated MCP endpoint; see [hosting and service contracts](53-cloudflare-accounts-and-mcp.md). It does not yet bridge agents to Studio projects.

## Guardrails

- Engine packages cannot import the web app, Studio, frontend environment settings or community integrations.
- Studio imports engine/authoring APIs; web imports Studio's supported build interface.
- Editor-only state such as selection, undo history, cameras and panels cannot enter runtime files.
- Generated bundles are outputs, never a second hand-edited source implementation.
- Account services sit behind explicit HTTP APIs in `packages/service`; the web Worker composes them with static hosting. Collaboration and live project/session pairing remain separate work.

Use [the package API guide](../packages/README.md) for engine contracts, [the migration record](19-workspace-migration.md) for implementation details, and [the single-project hosting guide](20-github-connected-hosting.md) for deployment.
