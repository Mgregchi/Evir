# Continue an existing path

14 October 2026. Studio can extend an existing open, unskinned path from either endpoint with Pen gestures or numeric point entry. The existing path stays intact until Finish commits the extension in one History transaction. This is an editor workflow over the existing cubic geometry/export contract; source and runtime schema versions do not change.

## Research and scope

[Rive Pen](https://rive.app/docs/editor/fundamentals/pen-tool-overview) documents corner clicks and drag-created Bézier handles. [Rive Edit Vertices](https://rive.app/docs/editor/fundamentals/edit-vertices) documents opening a path, reversing direction and straight/mirrored/detached handles. [Penpot's official path guide](https://raw.githubusercontent.com/penpot/penpot-docs/dae434432ed4a523ea1013666aa23451dbd12eb8/user-guide/objects/index.njk) distinguishes corner clicks, curved drags, first-node closing and open paths. The attempted help-site URL returned 404; the pinned official repository supplied the readable evidence instead. [The source register](../research/path-continuation/sources.json) records retrieval status and hashes.

These sources establish the underlying point/handle semantics. Evir's explicit First/Last selector, reversible draft and numeric entry are product choices for the existing continuation gap. They are not claims about identical competitor interactions. [WCAG dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) requires a single-pointer alternative to dragging; numeric entry supplies one for new curved points. Mirrored creation does not add a persistent mirrored-handle constraint: after Finish, the existing Inspector can edit either handle independently.

## Walkthrough

1. In **Design**, select one path and open **Properties**. If it is closed, choose **Open path** under Path controls. Opening and extending remain separate undoable operations.
2. Choose **Continue path…**, select **First endpoint** or **Last endpoint**, and optionally enable **Close when finished**. Apply starts the draft. On compact layouts, the sheet and Properties drawer close and focus moves to the canvas.
3. Click for corners or drag for mirrored curves. Alternatively choose **Add point…** in the stage footer. Enter **New point X/Y** in the path's local coordinates. Enable **Curved point** and enter **Curve handle X/Y**; the opposite handle mirrors about the new anchor. Apply adds to the draft, not the source.
4. **Finish extension** (or Enter on the stage) keeps the same layer ID, transform, parent, paint and old point records. **Undo** reverses the whole extension; Redo restores it. Clicking the highlighted first draft anchor can also close the path after adding a point.

Backspace/Delete remove only newly added points. The original points cannot be removed through draft shortcuts. Escape or **Cancel** discards the whole extension and returns to Select. Undo during a draft cancels it without undoing older source edits. Pointer cancellation, lost capture, blur, resize and a second touch retain the existing gesture rollback policy: an unfinished new point is removed, while completed draft points stay available. Drafts do not enter saved recovery or exports; saving, exporting, switching mode and source edits require finishing/cancelling first. Enter on a focused button now activates that button rather than accidentally finishing a drawing.

## Data and practical limits

Continuing from First uses a reversed working copy with swapped handles; Finish restores the original source direction. Existing anchors, in/out handles and point IDs remain unchanged and ordered, with new points prepended or appended as appropriate. Local coordinates use the inverse of the path's full authored world transform, including its own transform and affine parents. Solid and gradient paint are retained. The native compiler keeps its existing rejection of local shear; continuation does not broaden that export subset.

The operation requires a visible, unlocked, open path and editable ancestors. Skinned paths must be unbound first: existing weights do not define influences for new vertices. Singular transforms reject before drawing. If a parent constraint makes the displayed parent space differ from the authored space, Studio asks for zero constraint strength or a path outside that chain before continuation. If the source path or its parent transform changes after the draft starts, Finish rejects without overwriting it; cancel and reopen the draft.

At most 256 new points and 4,096 total points are allowed per continuation. Numeric coordinates and mirrored handles must be finite and within ±1,000,000 local units. Budget and numeric failures preserve the draft and source. Open paths keep the existing fill behavior, which fills across their endpoints; a two-point straight path has no area. This adds no strokes, pressure-sensitive brush system, freehand gesture concatenation, automatic smooth joins, cross-path joining or new skin weights. Those require separate authoring/render/export contracts.

## Original Sprig study and acceptance

**Sprig — a story still growing** is the nineteenth original gallery study. Its completed leaf has six curved points and a gentle Breeze rotation loop. The gallery provides completed source/export/poster, an open three-point starting project and native export, and a readable point recipe. The recipe is a teaching aid, not a new import format.

Open the starting project, select **growing leaf**, continue from Last and enable Close when finished. Add three numeric curved points: anchors **(45,35), (-10,65), (-60,35)** with handles **(26,56), (-43,60), (-74,15)**. Finish produces the completed leaf while preserving the original three point records. Undo returns the open starting geometry. The generator itself uses the continuation implementation, with deterministic point IDs for the published source.

`npm run test:editor` includes continuation units and four browser workflows at 320/390 portrait, 844 landscape and 1440 desktop. They exercise both endpoints, numeric and actual Pen curves under an affine parent, invalid input, gesture cancellation, original-point protection, identity/paint retention, single-step Undo/Redo, button keyboard activation, modal-to-canvas focus, recovery excluding drafts and automated WCAG checks. Existing drawing, guides, animation, assets and local-agent workflows remain regression gates.

`npm run validate:editor` retains the broader official authoring/playback oracles. `npm run test:web` checks all nineteen studies and compares Sprig's open seed and finished native exports at selected frames with official Canvas2D/WebGL2 runtimes. `npm run test:frontend` also verifies that applying the published recipe to the starting source reproduces the completed source exactly. The [validation ledger](../research/results/path-continuation/validation.json), screenshots and [native evidence](../research/results/path-continuation/native.json) record actual results. Physical tests remain postponed, human/screen-reader evidence remains open, and hosted backend services remain deferred.

Follow-up: [explicit endpoint joining and Outing](44-path-joining-and-outing.md) now connect or merge two existing compatible open paths. The continuation workflow above remains separate; freehand gesture concatenation and automatic smoothing remain open.
