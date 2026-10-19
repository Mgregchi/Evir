# Advanced 2D authoring contracts

Research and implementation: 11 October 2026. This is the current feature contract, alongside the consolidated [remaining-work table](25-studio-navigation-and-remaining-work.md). Backend services and AI/MCP integration are excluded from this increment. The single hosted `apps/web` still imports Studio at `/editor/studio/`; engine packages remain independent.

The [17 October contour expansion](42-editable-riv-contours.md) adds mixed straight/mirrored/asymmetric/detached vertices, static ellipses, rectangle origins and unskinned contour transforms. Geometric constraints become editable detached controls; animated contour geometry and general Editor-file conversion remain open.

## Research and shipped Rive game features

[Retrieval provenance](../research/advanced-authoring/sources.json) records public URLs, HTTP outcomes, byte counts and SHA-256 hashes. The wrong `/use-cases/games` URL returned 404 and supplied no evidence. The correct [game UI page](https://rive.app/game-ui), [Unity integration](https://rive.app/docs/game-runtimes/unity/unity), [Unreal integration](https://rive.app/docs/game-runtimes/unreal/unreal), [scripting announcement](https://rive.app/blog/scripting-is-live-in-rive) and [Luau rationale](https://rive.app/blog/why-scripting-runs-on-luau) were read before implementation.

Guido Rosso's [public profile](https://x.com/guidorosso) was accessible. Its retrieved posts include [Rive City with playable billboard minigames](https://x.com/guidorosso/status/2108732313018450155), [mixed vector/3D vehicle graphics](https://x.com/guidorosso/status/2108966830232707425), and [Rocket Squadron built through CLI-assisted authoring](https://x.com/guidorosso/status/2107146407790666085). The profile also discusses keyboard input and game development. These are vendor demonstrations and claims, not Evir implementations or independently measured performance. Platform availability, licensing and runtime features must be checked per distribution rather than inferred from one promotional post.

The practical lesson is that game capability involves runtime logic, input, authored interactions and rendering together. Unity/Unreal integrations, native mixed 3D/vector rendering and Luau scripting are distinct capabilities. Evir's current 2D scene player does not implement those systems, physics, a script VM, gamepad input or 3D. They belong in subsequent research, independently of the backend proposal.

Primary implementation references:

- [Rive fills](https://rive.app/docs/editor/fundamentals/fill-and-stroke), [meshes](https://rive.app/docs/editor/manipulating-shapes/meshes), [IK](https://rive.app/docs/editor/constraints/ik-constraint) and [text](https://rive.app/docs/editor/text/text-overview).
- Generated binary schema at pinned Rive commit `7aa93402a27c800db8a36acc8672612c100ea9b1`; explicit IDs, property wires and inheritance remain in `packages/format/schema/runtime.json`. Live upstream implementation was also read for gradients, IK, meshes, feather, text and transition flags. Successful 2.44.0 oracle tests, rather than a moving `main` source URL, establish this increment's tested compatibility.
- [FontFace](https://developer.mozilla.org/en-US/docs/Web/API/FontFace) and [Canvas filter](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/filter) inform browser resource loading and approximate feather rendering. Existing WAI/sheet/reduced-motion research continues to govern Studio interactions.

## What works and how to use it

| Contract | Authoring and runtime behavior | Boundary |
| --- | --- | --- |
| Animated paints | Animate offers gradient endpoints and each stop's color/position. Gradient keys upgrade source explicitly through that authoring operation. Linear/radial paint also works on skinned cubic paths. | Fixed stop count/type per animation. Stops are sorted for rendering; interpolation clamps stop positions. No animated topology or paint-type switching. |
| Clipping | Select a shape/group, choose **Clipping & feather…**, select an independent rectangle/path mask, and choose whether its artwork stays visible. Descendants inherit clipping; nested masks intersect. Removing a mask cleans its references. | Nonzero rule; one mask per target; no ancestor/self masks or compound multi-contour source nodes. |
| Outer feather | The same sheet exposes strength from 0–64. `.riv` emits an actual Feather component and clockwise Fill rule. Evir's Canvas renderer uses blur at half strength, scaled by the view. | Approximation, not an implementation of Rive Vector Feathering. No inner feather or offsets. Rive Canvas ignores feather in the tested fixture; WebGL2 renders it. Numeric envelopes report this difference instead of claiming equality. |
| Text and assets | **Create → Assets…** adds editable single-line text, a PNG image, or a textured PNG mesh. Supply a TTF/OTF font, or use the bundled Noto Sans Latin subset. Text size/fill can be keyed. **Edit text…** changes text/size. | Browser font shaping; no rich runs, paragraph layout, variable-font axes, text modifiers or universal shaping parity. Default bundled font covers ASCII U+0020–007E; supply an appropriate font for other writing systems. Missing glyph/fallback behavior is not certified against Rive. |
| Textured meshes | **Edit mesh…** exposes positions, normalized UVs, triangle indices and simple whole-mesh bone binding. Runtime/export/import preserve up to four normalized influences per vertex. | [Graphical weight authoring](43-graphical-skin-weights.md) now adds one-to-four-bone binding, a bounded brush and numeric vertex weights; auto weights/smoothing/influence locks remain open. No mesh topology animation or texture wrapping outside 0–1 UVs. Canvas triangle seams can differ from GPU rasterization. |
| IK | Select the tip bone, choose **Inverse kinematics…**, and pick an independent target, one/two-bone chain, direction and strength. Animate the target to drive the pose. | Unit positive scales throughout the chain/ancestors; no overlapping or interdependent constrained chains, longer chains, stretch, shear or animated scaling of constrained ancestors. Unreachable targets clamp to chain reach. |
| Mixing | **Interact → Blending & timing…** adds millisecond transition durations and optional exit-time guards. A number input controls a 1D blend of animation poses. The runtime splits time at transition/mix boundaries so a large delta retains elapsed time. Reset clears active mixing and restores defaults. | One machine layer; 1D children are animations, not recursively nested blend graphs. Sheet exposes two endpoints; additional sorted children are source-editable. [Ordered direct states and Lumen](45-direct-blends-and-lumen.md) now add fixed/input percentage rows in a one-state machine. Nested/direct transition graphs, per-layer masks, arbitrary event/listener actions and transition interruption remain open. Existing typed conditions, AND guards, triggers and click listeners remain supported. |
| Editable `.riv` import | **Open project** accepts `.riv`. The bounded binary reader reconstructs supported scene nodes, paints, skins, IK, clips, assets, keyed properties, timed machines and 1D blends into source. Embedded asset hashes are recomputed. Unsupported records/properties reject the import before project replacement. | Declared subset only. Many supplied Editor exports use unsupported features and will reject. No `.rev` history reconstruction, external/CDN assets, arbitrary compound geometry, multi-layer machines, data binding, scripts or universal editable Rive import. Source IDs are newly generated because runtime component IDs do not encode Evir IDs. Runtime-only state names get generated labels. |

Opening v1/v2 source still preserves its prior migration behavior. Advanced features use source **version 3**, with explicit `advanced.clips`, `advanced.feathers` and `advanced.ik`. Runtime snapshots for advanced source use **version 2**, retaining scene content while excluding cameras, visibility preferences, locks and state-graph positions. Existing v2 source exports retain their published bytes.

Effects, assets, IK and timing sheets keep isolated drafts, custom error feedback, Escape/cancel and focus return. Apply performs one history transaction. Mobile workflow controls remain in the Machine/Timeline drawer; effects stay in Properties. Invalid topology, masks, weights, IK dependencies and import data reject atomically.

The mesh sheet edits one indexed vertex at a time, with previous/next controls, rather than allocating controls for the entire mesh. Asset uploads are size-checked before reading; pending asset creation can be cancelled and Apply cannot start duplicate submissions. Validation messages remain inside the active sheet.

## Asset lifetime and memory

`CanvasRenderer.prepare(project)` decodes and registers assets before `draw`; call `dispose()` on replacement/unmount. A failed preparation keeps the old resource set. Replacement closes old ImageBitmaps and deletes the host's FontFace registrations; disposal also cancels pending preparation through a generation token. Studio loads assets before installing an opened project; previews load lazily and dispose on teardown. Static studies do not run a motion loop.

The implementation limits each asset to 16 MiB, all embedded assets to 32 MiB and 64 records, each PNG to four megapixels, and a project to eight megapixels of decoded images. PNG dimensions are checked before bitmap allocation. Base64 encoding uses bounded chunks. These are product budgets, not measured device memory limits: font shaping, browser/GPU copies and history snapshots add costs. Physical measurements remain required.

## Examples and evidence

Six original studies are added to the public gallery, alongside the prior eight: **Canopy** (clipping, animated/skinned gradient), **Halo** (outer feather), **Reach** (two-bone IK), **Kite** (textured mesh skin), **Caption** (editable font/text) and **Blend** (timed transition and 1D input). Each has source, a compiled `.riv`, a real renderer-captured poster and Studio inspection instructions. No supplied third-party artwork is republished.

The [advanced evidence directory](../research/results/advanced-authoring/) contains Canvas/WebGL2 oracle reports, responsive Studio flows and screenshots. Oracle execution uses pinned official runtimes 2.44.0 in headless Chromium with software rendering. Static/keyed pixels, timed transitions and 1D blend outcomes are compared; source/runtime/import round trips and malformed inputs are checked separately. Font/bitmap replacement, failure and disposal are checked in the browser. Automated axe checks cover the new sheet; they are not a screen-reader or human usability study.

The [validation ledger](../research/results/advanced-authoring/validation.json) records 54 editor unit tests, six runtime and fourteen frontend checks, the editor browser regression suites, fourteen gallery sources loaded/exported in Studio, and 83 gallery comparisons per official backend. The dedicated advanced suite adds 33 comparisons per backend, including one-bone, inverted and half-strength IK variants. Reports include source/export hashes and software GPU diagnostics; the ledger verifies the retained fixtures match those hashes.

[Actual supplied-file import attempts](../research/results/advanced-authoring/supplied-import.json) record file hashes and the first unsupported component for each of five available exports. All five reject editable import: their contracts include ViewModels, data converters or audio assets outside the declared subset. Retrieving the uploaded room-decor export failed because it exceeds the execution tool's 32 MiB transfer limit; it was not tested. The semantic importer also has an explicit 32 MiB file budget. The reader follows upstream's four property-table entries per word; a regression fixture covers this packing and duplicate header keys. Passing our original round trips does not establish compatibility with these complex Editor exports.

Run:

```sh
npm run test:runtime
npm run runtime:build
npm run test:frontend
npm run test:editor
npm run validate:editor
npm run test:web
npm run test:experience
```

Regenerate original sources/exports with `node apps/web/generate-examples.mjs`, then posters with `EVIR_CAPTURE_EXAMPLES_ONLY=1 node tools/capture_site_assets.cjs`. Font origin, license and subset generation are recorded in [font provenance](../assets/fonts/README.md).

## Closure status

The initial declared contracts above are implemented. This does **not** close all richer-feature parity. The table states the remaining implementation boundaries: richer shaping/layout, inner feather, general IK, automatic/smoothed/locked skin weights, direct/nested blends and broader Editor-file import. Equivalent Rive Editor-produced scenes, physical-device measurements and human/assistive-technology testing remain evidence requirements. Backend and AI/MCP services remain excluded by the user's instruction. New game/3D/script capabilities require their own research and architecture decisions; they have not been silently added to the 2D feature contract.
