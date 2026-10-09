# Shared Evir packages

These are versioned npm workspaces with one source of truth. Applications consume their explicit exports; production packages do not import application UI, tools, research scripts or official Rive runtime packages. The engine currently implements the existing Canvas2D vector subset.

| Package | Owns |
| --- | --- |
| `@evir/project-model` | Editable source validation/persistence, scene transforms and the runtime snapshot contract |
| `@evir/runtime` | Playback API, animation evaluation, skinning and conditional state machines |
| `@evir/renderer-canvas` | Canvas2D drawing and the host rendering adapter |
| `@evir/authoring` | Path/bone/key editing, binding, reparenting and undo transactions |
| `@evir/format` | Explicit `.riv` subset compiler and its pinned schema |

The direction is `project-model` → `runtime` → renderer/authoring/format. The model validates animation/interaction data itself, so it no longer imports the playback evaluator. Applications select the packages they use. The public site bundles runtime/renderer previews; Studio additionally bundles authoring and export. A site build does not write editor or package release artifacts.

## Playback in a host application

```js
import { loadRuntime } from '@evir/runtime';
import { CanvasRenderer } from '@evir/renderer-canvas';

const player = await loadRuntime(projectJSON, { machineId: 'milo-machine' });
const renderer = new CanvasRenderer(canvas.getContext('2d'));
renderer.draw(player.advance(0), player.artboard.id);
player.setInput('isWaving', true);
renderer.draw(player.advance(1 / 60), player.artboard.id);
player.reset();
```

Use the actual animation/machine IDs from your project. Choose `animationId` or `machineId`; scheduling, device scaling and pointer hit-testing belong to the host. `advance` takes seconds. `setInput` accepts an input name or stable ID and validates the value type; triggers take `true`. `click` accepts a known target ID. `pose`, `snapshot`, `artboard` and `state` return detached values. The runtime has no DOM, account, storage or app-environment dependency.

`loadRuntime` accepts editable project JSON or a version-1 `evir-runtime` JSON snapshot and verifies embedded asset hashes. `toRuntimeProject` from `@evir/project-model` strips editor cameras, locks, hidden-layer controls and graph positions. This is a JSON playback contract for the existing scene subset, rather than a new optimized binary-format decision. Existing source files continue to open unchanged. Assets can be preserved/validated; raster/text rendering, semantic `.riv` import and GPU/native backends remain future work.

## Build and release

```sh
npm ci
npm run test:runtime
npm run runtime:build
npm pack --workspace @evir/runtime --dry-run
```

Every package has its own version, exports, MIT license and standalone `dist/index.mjs` module. Node/bundler consumers use the source exports with versioned package dependencies; browser hosts can use the standalone module without a workspace install. Published archives include the source, documentation and built modules; the format adapter also retains the upstream schema license. Build from the root before packing. Package names/versions must be coordinated when an API change affects dependents; npm publication is an explicit release step and is not performed by CI.

Backend services for accounts, collaboration, storage or agents remain a separate future boundary. They are not required for the local editor or runtime.
