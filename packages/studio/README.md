# Evir Studio package

`@evir/studio` owns the editor's browser UI, styles and template. The sole frontend application, `apps/web`, imports `@evir/studio/build` and renders the workspace into its `/editor/studio/` directory. The package has no hosting configuration or environment file.

Run `npm ci`, `npm run web:build`, then `npm run web:serve` from the repository root. Open `http://127.0.0.1:8787/editor/studio/` in a modern desktop browser. Studio's home link returns to the same web app. Web Crypto requires localhost or HTTPS; no account or remote storage is needed.

Project validation, authoring, playback, drawing and `.riv` export remain in the [engine packages](../README.md). The build bundles those APIs and the schema; runtime export makes no request to the research directory. Editing this package does not move its implementation into the web app or publish a runtime release. See [the ownership decision](../../docs/18-architecture-boundaries-and-deployment.md) and [web hosting guide](../../docs/20-github-connected-hosting.md).

The four editor milestones are implemented for a declared vector subset:

| Workspace | Authoring controls |
| --- | --- |
| Design | Artboards, nested groups, solid rectangles and cubic paths; Pen drawing; rectangle conversion; anchors and detached in/out handles; point insertion/removal, open/closed paths; direct point dragging and numeric coordinates. |
| Rigging in Design | Root/child bone chains; child attachment at the parent tip; bind/unbind and captured world bind matrices; one to four normalized influences per anchor or handle, independently editable. |
| Animate | Named timelines, FPS, duration, typed property tracks; numeric/color keys; linear, hold and editable cubic easing; key values, retiming/deletion; scrub/playback. Inspector and stage moves record keys while leaving authored defaults unchanged. |
| Interact | One-layer machines, entry/animation states, boolean/number/trigger inputs, directional AND conditions, click listeners; input testing, playback and reset. Graph edits persist in the editable source. |
| Export | Download `.riv` and its source-ID map, with schema-derived indices and property keys. Both official web runtimes exercise the output. |

Layers are searchable and support selection, affine transforms, world-preserving reparenting, sibling order, lock/hide, subtree deletion, pan/zoom/fit and undo/redo. A drag commits one undo step; Escape cancels. Select a nested shape directly with Ctrl/Command-click or through Layers. Child bones rotate at their parent tip; change the parent's length to move that attachment. Split inserts a point without changing the original curve. Rebind before changing a bound path's topology.

Use **Pen** or **P** in Design to draw a custom path. Click for a corner; drag for mirrored Bézier handles. **Enter / Finish path** commits an open path with at least two points. Click its first anchor after three points to close it. **Escape / Cancel path** discards the draft; **Backspace** removes its last point. Finish creates one undo step and returns to Select; the existing Edit points controls can then edit the handles independently. A selected visible, unlocked group or bone becomes the parent, with world positions preserved. Other selections create a root path. Hold Space to pan during drawing. Finish/cancel before switching tools, editing, saving or exporting. Drafts are marked unsaved and are not stored on reload; committed paths use normal browser recovery and project saving. Paths use solid fills; an open path does not introduce a stroke, and a straight two-point path has no filled area.

Save project downloads editable source as `.evir-project.json`. Browser local storage retains the last committed copy, with visible persistence status. New/Open offer saving a copy before replacement. Opening validates the document and embedded asset hashes before replacing the canvas; rejected content leaves the current project unchanged. Supported v1 projects migrate explicitly to v2, preserving existing content and adding empty animation/machine arrays.

Export deliberately differs from saving. The compiler rejects sheared/singular node transforms, out-of-range runtime floats and attached assets before downloading. Locks, hidden layers and graph positions are editor controls, so hidden artwork is included in runtime output. Runtime animation application retains unkeyed values; exported timelines add constant default tracks for missing properties in the animated-property union to reproduce Studio's pose/reset semantics. Export does not alter source keys.

The subset does not include `.riv` semantic import, SOBO editing, raster/text assets, gradients, clipping authoring, feathering, IK, meshes, blend trees, nested machines, transition mixing, RML authoring or a custom GPU renderer. Paths can be drawn with Pen or start as an editable cubic ellipse or converted rectangle. Freehand drawing, persistent mirrored-handle constraints and extending existing paths with Pen remain subsequent work. The graph uses forms and a visual overview; node dragging is not implemented. Physical-device performance, representative usability testing, and full Rive parity remain unproven. Desktop widths below 850 pixels retain the existing horizontal-overflow layout.

The user supplied the wordmark and icons, then permitted cropping, proportional resizing, conversion and background removal while preserving their appearance. The former improvised mark has been removed. Prepared white-on-dark renditions appear in the header and browser icon; [asset provenance](../../assets/brand/README.md) distinguishes these image-assisted preparations from inaccessible byte-identical originals. Both app builds copy the existing PNG files unchanged.

Run `npm run test:editor` for model and browser workflows, then `npm run validate:editor` for Canvas2D and WebGL2 official-runtime pixel and interaction oracles. Run `npm test` for the existing binary research suite. [Research](../../docs/12-editor-milestone-research.md) records the primary sources and findings; [acceptance evidence](../../docs/13-editor-milestone-acceptance.md) records the implemented scope and measured checks.

## Project format v2

Top-level fields are `format: "evir-project"`, `schemaVersion: 2`, stable `id`, `name`, `artboards`, `nodes`, `assets`, `editor`, `animations` and `machines`. IDs are unique across records; references use source IDs, not runtime indices. Unknown fields, versions, broken references and invalid typed values are rejected.

Artboards contain ID/name and positive dimensions. Nodes contain ID/name/kind, artboard ownership, nullable parent ID, unique nonnegative sibling order, finite affine `[a,b,c,d,tx,ty]` transform and kind-specific geometry. Groups and bones can own children. Ascending sibling order paints first. Groups have null geometry; rectangles have width/height/fill. Bone geometry has length; child-bone stored X/Y are zero, with world translation evaluated at the parent tip.

Path geometry contains `closed`, `fill`, stable point records (`id`, `anchor`, `in`, `out`) and nullable `skin`. A skin stores the path world bind matrix, bone references/world bind matrices, and independent normalized anchor/in/out influences for each point. Largest-remainder quantization makes packed weights total exactly 255.

Animations reference an artboard and contain FPS, frame duration, loop flag, and target/property tracks of sorted unique frame keys. Keys carry typed values and linear/hold/cubic easing. Machines reference animations through stable state IDs; typed inputs, directional transitions with AND conditions, entry state, graph positions and click actions are validated together. Preview evaluation clones the source; test inputs and clocks never enter the project. Graph edits restart preview from input defaults. Opening or resizing the authoring panel refits the artboard into the visible stage.

Assets retain name/MIME/SHA-256/base64 content and are verified asynchronously on open/save. Their preservation does not imply rendering/export support. Editor state retains locks, hidden node IDs and cameras; selection and history are session state. History retains at most 100 snapshots. This is a correctness-first authoring model, not a SOBO-scale performance claim.

Reparenting preserves world transforms, including shear, and rejects ownership/cycle/singular-parent violations. Child-bone reparenting requires a tip-compatible world position. Deleting a subtree removes its tracks and click listeners; deleting a bone still referenced by a surviving skin is rejected until the path is unbound. Undo restores the entire prior document.
