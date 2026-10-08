# Evir Studio foundation

Run `npm run editor:serve`, then open `http://127.0.0.1:8080/editor/` in a modern desktop browser. Web Crypto requires localhost or an HTTPS origin. There is no build step, account requirement or remote storage. Dependencies are only needed for the test harness.

The first workspace supports artboards, nested groups, solid rectangles, named/searchable layers, direct and group selection, affine position/rotation/scale, world-preserving reparenting, sibling draw order, lock/hide, subtree deletion, pan/zoom/fit, and undo/redo. A drag previews changes and commits one undo step; Escape cancels. Inspector edits and hierarchy actions are transactions.

Save project downloads editable source as `.evir-project.json`. A committed copy is also stored in this browser's local storage; the status text distinguishes local persistence from failure. New/Open explicitly offer saving a copy before replacement. Opening validates the entire document and embedded asset hashes before replacing the canvas. Corrupt or unsupported data leaves the current project unchanged.

This is a Design prototype, not a finished animation editor. It does not open SOBO or other `.riv` files, animate paths, author rigs/state machines, or export `.riv`. The existing structural `.riv` research tools remain separate. Embedded assets can be preserved and verified in the project bundle, but asset insertion/rendering controls are not implemented. The current project version supports groups and rectangles; unknown features/fields or schema versions are rejected explicitly, rather than discarded.

Run `npm run test:editor` for the model and browser acceptance checks. [UX research](../docs/11-editor-ux-research.md) explains the platform study, implemented decisions and remaining usability work. [Foundations](../docs/10-editor-foundations.md) sets out the subsequent animation and export milestones.

## Project format v1

The top-level fields are `format: "evir-project"`, `schemaVersion: 1`, a stable project `id`, `name`, `artboards`, `nodes`, `assets` and `editor`. IDs must be unique across the project, artboards, nodes and assets; references use IDs rather than serialized indices.

Each artboard has `id`, `name`, positive finite `width`/`height`. Every node has `id`, `name`, `kind`, `artboardId`, nullable `parentId`, a unique nonnegative sibling `order`, six finite affine `transform` values `[a,b,c,d,tx,ty]`, and `geometry`. Lower sibling order draws first; higher order appears in front. Only groups can own children. Group geometry is null; rectangles have positive `width`/`height` and a `fill` in `#RRGGBB` or `#RRGGBBAA` form.

Assets contain `id`, `name`, `mimeType`, lowercase SHA-256 `sha256` and base64 `data`. Opening and serializing recompute each content hash. The synchronous transaction validator checks asset structure; cryptographic integrity is checked at the asynchronous persistence boundary.

Editor state includes `locked` and `hidden` node-ID arrays and per-artboard `cameras` with finite `x`, `y` and positive `zoom`. Scene edits enter undo history; camera navigation remains separate and is included in the saved bundle. Selection and undo history are session state. Undo history retains at most 100 document snapshots; this is a correctness-first foundation, not an optimized representation for SOBO-scale authoring.

A parent change computes `inverse(newParentWorld) × oldNodeWorld`, retaining rotation, scale and shear without decomposing the matrix. Singular target-parent transforms, ownership violations and parent cycles are rejected atomically. Deleting a group removes its subtree and the deleted nodes' lock/visibility entries; undo restores them together. Future tracks, constraints and listener references require explicit schema and deletion-policy extensions before those features can be added.
