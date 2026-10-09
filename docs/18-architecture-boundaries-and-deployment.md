# Product boundaries and deployment architecture

**Decision recorded:** 9 October 2026

Evir will be managed as a product family with separate public presentation, authoring application and reusable runtime boundaries. This follows the way mature creative tools separate their marketing/product surface from the application people use and from the runtime that ships inside their products.

## Target product surface

| Surface | Example URL | Responsibility | Deployment boundary |
| --- | --- | --- | --- |
| Main product page | `https://evir.example/product` | Explain the product, show capabilities, examples and use cases, then route people to try it | Static public site |
| Public home | `https://evir.example/` | Project identity, updates and community entry points | Static public site |
| Editor landing page | `https://evir.example/editor` | Explain the editor, supported workflows and how to start | Editor web shell or public site route |
| Editor application | `https://studio.evir.example/` | Authoring workspace, project loading, editing, preview and export | Independently deployable editor frontend |
| Runtime packages | npm/mobile packages or a service endpoint | Load projects, evaluate animation/state machines and render in host products | Independently versioned runtime/backend packages |
| Research and operations | Repository and private CI/device harnesses | Format studies, benchmarks, compatibility evidence and release checks | Development/research infrastructure |

The exact domain is configurable. The important boundary is that `/editor` is a discoverable landing page while the full workspace may live at a separate editor subdomain. A custom domain, reverse proxy or local deployment can map these surfaces without changing project code.

## Current state

The separation was implemented on 9 October 2026. See [the migration and verification record](19-workspace-migration.md) for commands, package contracts and hosting precautions. The monorepo now has these actual ownership boundaries:

- `apps/site/` owns public content, branding, SEO, navigation, configurable external links and examples. It builds without copying the editor.
- `apps/editor/` owns Studio's browser UI and consumes shared packages.
- `packages/` owns the validated model, playback engine, Canvas2D renderer, authoring operations and explicit `.riv` compiler. Applications bundle their declared package dependencies, rather than copying source from another application.
- `tools/` and `research/` contain the structural `.riv` codec, official-runtime probes, benchmarks and evidence. The pinned compiler schema lives with `packages/format/` and retains its upstream license.
- `@rive-app/canvas` and `@rive-app/webgl2` validate exported files and supplied `.riv` inputs. They are official Rive runtimes, not Evir's own runtime.

`packages/runtime/` is now the standalone Evir playback core; `packages/renderer-canvas/` provides its Canvas2D host adapter. The `.riv` compiler still covers a declared subset. Full semantic `.riv` import, an independent GPU renderer and device-proven runtime performance remain separate work. No backend service has been introduced.

## Target repository shape

The implemented shape, with future boundaries explicitly marked:

```text
apps/
  site/              # product pages, /, /product, /editor landing
  editor/            # separately hosted authoring application
assets/brand/        # supplied artwork renditions
packages/
  project-model/     # validated editable Evir project contracts
  runtime/           # platform-neutral loading, motion and state machines
  renderer-canvas/   # Canvas2D backend
  authoring/         # editing operations and history
  format/            # explicit .riv compatibility compiler and schema
research/
tools/
```

Package source is now the source of truth. Generated app/package artifacts must never become a second hand-edited implementation. A future GPU renderer and backend services should add their own boundaries when the corresponding research and product requirements justify them.

## Migration order

The original sequence below is implemented for the existing web/Canvas2D subset. GPU/mobile targets and a finalized Evir binary format are not part of this migration.

1. Define a small runtime-facing contract for loading a validated project, advancing time, applying inputs and drawing a frame.
2. Extract pure code from `editor/model.mjs`, `editor/motion.mjs` and `editor/render-scene.mjs` into tested runtime packages without changing editor behavior.
3. Keep the editor UI dependent on those packages; keep public pages dependent only on published examples and a supported preview adapter.
4. Add independent runtime entry points and package-level tests for web, Canvas2D and later GPU/mobile targets.
5. Move `.riv` compatibility into an explicit format adapter. Do not let Rive compatibility types leak through the core Evir project contract.
6. Split deployment: public site builds separately, editor web builds separately, and runtime packages release independently. Shared versioned packages and documented API contracts replace copied source files.

The separation should be measured by ownership and release boundaries, not by forcing separate repositories prematurely. A monorepo is suitable while the contracts are changing; independent packages and deployments give the desired isolation without losing coordinated tests.

## Guardrails

- A public-page or brand change should not require rebuilding or publishing the runtime.
- A runtime change should be validated by package tests and editor integration tests before editor deployment.
- Editor-only state such as selection, undo history, cameras and panels must not enter runtime files.
- Product pages may show capabilities only when the corresponding editor/runtime evidence exists.
- The runtime must not depend on the public site, its environment variables or its analytics/community integrations.
- Backend services, if introduced later for accounts, collaboration, asset storage or agent jobs, should sit behind explicit APIs. The local runtime and editor must remain usable without those services where the product promises local authoring.

This decision now governs the implemented workspace boundaries and future engine/frontend work.
