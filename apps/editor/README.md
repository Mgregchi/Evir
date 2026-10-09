# Evir Studio

From the repository root, run `npm ci`, `npm run editor:build`, then `npm run editor:serve`. Open `http://127.0.0.1:8788/` in a modern desktop browser. Web Crypto requires localhost or HTTPS. The application needs no account or remote storage.

Studio is independently deployed from `apps/editor/dist`. Its browser UI lives here; project validation, authoring operations, motion, rendering and export live in [versioned shared packages](../../packages/README.md). The build bundles those package APIs and the `.riv` schema; runtime export makes no request to the research directory. The public site's `/editor/` page introduces Studio and launches this application at its configured address.

## Hosting

Use [the GitHub-connected deployment guide](../../docs/20-github-connected-hosting.md). Set **the same `SITE_URL` and `STUDIO_URL` values as the public-site project**. Studio derives its home link from `SITE_URL` and its path from `STUDIO_URL`. No community/social settings are needed here.

Local builds work without an environment file. To customize them, copy [`.env.example`](.env.example) to `apps/editor/.env`; production values belong in your provider's build environment. All settings are public; rebuild after editing.

The output stays `apps/editor/dist` whether Studio has a subdomain or uses [the `/editor/studio/` route](../../docs/21-studio-path-hosting.md). `/editor/` stays the public landing page.

The four editor milestones are implemented for a declared vector subset:

| Workspace | Authoring controls |
| --- | --- |
| Design | Artboards, nested groups, solid rectangles and cubic paths; rectangle conversion; anchors and detached in/out handles; point insertion/removal, open/closed paths; direct point dragging and numeric coordinates. |
| Rigging in Design | Root/child bone chains; child attachment at the parent tip; bind/unbind and captured world bind matrices; one to four normalized influences per anchor or handle, independently editable. |
| Animate | Named timelines, FPS, duration, typed property tracks; numeric/color keys; linear, hold and editable cubic easing; key values, retiming/deletion; scrub/playback. Inspector and stage moves record keys while leaving authored defaults unchanged. |
| Interact | One-layer machines, entry/animation states, boolean/number/trigger inputs, directional AND conditions, click listeners; input testing, playback and reset. Graph edits persist in the editable source. |
| Export | Download `.riv` and its source-ID map, with schema-derived indices and property keys. Both official web runtimes exercise the output. |

Layers are searchable and support selection, affine transforms, world-preserving reparenting, sibling order, lock/hide, subtree deletion, pan/zoom/fit and undo/redo. A drag commits one undo step; Escape cancels. Select a nested shape directly with Ctrl/Command-click or through Layers. Child bones rotate at their parent tip; change the parent's length to move that attachment. Split inserts a point without changing the original curve. Rebind before changing a bound path's topology.

Save project downloads editable source as `.evir-project.json`. Browser local storage retains the last committed copy, with visible persistence status. New/Open offer saving a copy before replacement. Opening validates the document and embedded asset hashes before replacing the canvas; rejected content leaves the current project unchanged. Supported v1 projects migrate explicitly to v2, preserving existing content and adding empty animation/machine arrays.

Export deliberately differs from saving. The compiler rejects sheared/singular node transforms, out-of-range runtime floats and attached assets before downloading. Locks, hidden layers and graph positions are editor controls, so hidden artwork is included in runtime output. Runtime animation application retains unkeyed values; exported timelines add constant default tracks for missing properties in the animated-property union to reproduce Studio's pose/reset semantics. Export does not alter source keys.

The subset does not include `.riv` semantic import, SOBO editing, raster/text assets, gradients, clipping authoring, feathering, IK, meshes, blend trees, nested machines, transition mixing, RML authoring or a custom GPU renderer. Paths start as an editable cubic ellipse or converted rectangle; there is no freehand/pen gesture tool. The graph uses forms and a visual overview; node dragging is not implemented. Physical-device performance, representative usability testing, and full Rive parity remain unproven. Desktop widths below 850 pixels retain the existing horizontal-overflow layout.

The user supplied the wordmark and icons, then permitted cropping, proportional resizing, conversion and background removal while preserving their appearance. The former improvised mark has been removed. Prepared white-on-dark renditions appear in the header and browser icon; [asset provenance](../../assets/brand/README.md) distinguishes these image-assisted preparations from inaccessible byte-identical originals. Both app builds copy the existing PNG files unchanged.

Run `npm run test:editor` for model and browser workflows, then `npm run validate:editor` for Canvas2D and WebGL2 official-runtime pixel and interaction oracles. Run `npm test` for the existing binary research suite. [Research](../../docs/12-editor-milestone-research.md) records the primary sources and findings; [acceptance evidence](../../docs/13-editor-milestone-acceptance.md) records the implemented scope and measured checks.

## Project format v2

Top-level fields are `format: "evir-project"`, `schemaVersion: 2`, stable `id`, `name`, `artboards`, `nodes`, `assets`, `editor`, `animations` and `machines`. IDs are unique across records; references use source IDs, not runtime indices. Unknown fields, versions, broken references and invalid typed values are rejected.

Artboards contain ID/name and positive dimensions. Nodes contain ID/name/kind, artboard ownership, nullable parent ID, unique nonnegative sibling order, finite affine `[a,b,c,d,tx,ty]` transform and kind-specific geometry. Groups and bones can own children. Ascending sibling order paints first. Groups have null geometry; rectangles have width/height/fill. Bone geometry has length; child-bone stored X/Y are zero, with world translation evaluated at the parent tip.

Path geometry contains `closed`, `fill`, stable point records (`id`, `anchor`, `in`, `out`) and nullable `skin`. A skin stores the path world bind matrix, bone references/world bind matrices, and independent normalized anchor/in/out influences for each point. Largest-remainder quantization makes packed weights total exactly 255.

Animations reference an artboard and contain FPS, frame duration, loop flag, and target/property tracks of sorted unique frame keys. Keys carry typed values and linear/hold/cubic easing. Machines reference animations through stable state IDs; typed inputs, directional transitions with AND conditions, entry state, graph positions and click actions are validated together. Preview evaluation clones the source; test inputs and clocks never enter the project. Graph edits restart preview from input defaults. Opening or resizing the authoring panel refits the artboard into the visible stage.

Assets retain name/MIME/SHA-256/base64 content and are verified asynchronously on open/save. Their preservation does not imply rendering/export support. Editor state retains locks, hidden node IDs and cameras; selection and history are session state. History retains at most 100 snapshots. This is a correctness-first authoring model, not a SOBO-scale performance claim.

Reparenting preserves world transforms, including shear, and rejects ownership/cycle/singular-parent violations. Child-bone reparenting requires a tip-compatible world position. Deleting a subtree removes its tracks and click listeners; deleting a bone still referenced by a surviving skin is rejected until the path is unbound. Undo restores the entire prior document.
