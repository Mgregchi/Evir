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

The current prototype is intentionally in one repository but already has recognizable seams:

- `site/` is the public static site. It owns page content, branding, SEO, navigation, configurable external links and public examples.
- `editor/` contains Evir Studio's browser UI and the first implementation of the project model, authoring operations, motion/state-machine evaluation, Canvas2D preview and `.riv` export.
- `tools/` and `research/` contain the structural `.riv` codec, schema, official-runtime probes, benchmarks and evidence. They are not production application code.
- `site/build.mjs` currently copies selected editor modules into the public build so the prototype can be demonstrated. That generated copy is a distribution convenience, not the desired long-term ownership model.
- `@rive-app/canvas` and `@rive-app/webgl2` validate exported files and supplied `.riv` inputs. They are official Rive runtimes, not Evir's own runtime.

The current editor implementation is therefore the closest thing to an Evir core, but it is not yet a standalone runtime package. The Canvas2D renderer is an authoring preview, and the `.riv` compiler covers a declared subset. Full semantic `.riv` import, an independent GPU renderer and device-proven runtime performance remain separate work.

## Target repository shape

The eventual ownership model should move toward:

```text
apps/
  public-site/       # product pages, /, /product, /editor landing
  editor-web/        # studio.evir.example authoring application
packages/
  project-model/     # validated editable Evir project contracts
  runtime/           # platform-neutral loading, motion and state machines
  renderer-canvas/   # Canvas2D backend
  renderer-gpu/      # later GPU backend
  format/            # .evir format and explicit .riv compatibility layer
research/
tools/
```

This is a destination, not an instruction to move everything in one change. Until the runtime contracts are stable, the existing `editor/*.mjs` modules remain the source of truth. Generated copies under `site/dist` must never become a second hand-edited implementation.

## Migration order

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

This decision is compatible with the current site and editor and gives the next engine-extraction milestone a clear destination.
