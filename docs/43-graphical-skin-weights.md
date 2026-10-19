# Graphical skin weights and Gust

Research and implementation: 18 October 2026. This adds graphical and numeric weight authoring for the existing path/control and textured-mesh skin contracts. The hosted app remains `apps/web`, with Studio at `/editor/studio/`. Physical tests remain postponed and hosted backend work remains deferred.

## Research before implementation

[Retrieval provenance](../research/skin-weights/sources.json) records primary-source URLs, hashes, outcomes and product choices. Rive's [Bones](https://rive.app/docs/editor/manipulating-shapes/bones) documentation describes per-vertex colored weight charts, independent Bézier-handle weights, normalization to 100% and its stage drag tool. It also describes broader auto-weight, smoothing and influence-lock features. Those broader tools are not implied by Evir's weight editor.

[WCAG dragging guidance](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) requires a single-pointer alternative to non-essential dragging; keyboard access alone does not meet that requirement. Evir therefore includes explicit numbered-vertex fields and an Apply action in addition to the brush. The attempted Blender brush page returned 403 and supplies no evidence.

Evir's brush is a product choice: a target weight, strength, screen-sized radius and swept falloff. Each gesture starts from frozen source weights and visible control positions. The greatest falloff reached along that gesture determines each result. Repeating a stationary event does not build up influence. Separate strokes can progressively approach the target. The runtime's existing largest-remainder quantization keeps packed weights at a total of 255.

## Using the tools

1. In Design, select a vector path or textured mesh. Use **Properties → Bind skin bones…** if it has no skin, or **Rebind skin bones…** to change its bindings. Pick one to four different bones in the same artboard. Binding resets the controls to equal shares; save an existing version if its weights should be retained. Binding captures the current geometry and bone world transforms.
2. Choose **Skin weights…**. Pick a bound bone and target percentage. Path controls can be **Anchor and both handles**, **Anchors only**, **Incoming handles only** or **Outgoing handles only**. Meshes use their vertex positions; their source control-weight slots remain synchronized.
3. For a non-dragging alternative, choose **Weight vertex number** and **Apply weight to vertex**. This commits immediately with its own Undo step. The percentage summary identifies numbered bones as well as colors. Closing the sheet keeps edits already applied; draft brush settings are discarded unless painting starts.
4. For the brush, set strength and radius, then choose **Start painting weights**. A click/tap applies one footprint; a drag sweeps between samples. Radius stays the same screen size as the camera zoom changes. Color charts show all bound influences. **Done weights** in the canvas footer exits painting; Escape cancels an active stroke, or exits painting when no gesture is active. Hold Space for temporary panning.
5. One completed stroke is one Undo step. Escape, pointer cancellation/lost capture, blur, stage resize, simulated hidden/pagehide lifecycle and a second finger on the stage roll back its provisional weights. Two-finger navigation cannot inherit a painting drag. A different pointer cannot move or finish the owning gesture.
6. Switch to Animate and scrub a bone timeline to inspect deformation. Return to Design to change weights. Saving and `.riv` export carry the resulting weights, geometry and assets; brush mode, radius, strength, colors, hover state and tool settings never enter either format. Reopening a project starts outside paint mode.

A single bound bone must retain 100%. Bind another bone before reducing its influence. Other bones share the remainder proportionally; if their previous total is zero, the remainder is distributed equally. A previously zero/omitted influence can be added again from any bound bone. Invalid batches reject before any control is changed. Hidden/locked layers and ancestors cannot be edited through these operations.

## Contract and bounds

`@evir/authoring` exposes `bindSkin(project, nodeId, boneIds)` and `setSkinWeights(project, nodeId, changes)`, shared by path and mesh tools. A change identifies a point ID, control, bound bone and value in `[0,1]`. Mesh changes use `anchor`; the helper copies that result into the mesh's source `in`/`out` slots. Existing `bindPath` and `setWeight` use these shared operations. An edit cannot contain duplicate point/control assignments or more than 12,288 assignments.

The brush allows at most 4,096 displayed controls and 2,048 distinct input samples per stroke. An oversized layer still has the numbered numeric editor. Radius is 8–160 screen pixels, strength/target are 0–100%, and camera zoom follows Studio's 10–400% limits. Geometry and asset bytes are preserved. These are authoring bounds, not measured device budgets. The brush uses a transform resolver and indexed control weights; it does not repeatedly scan every weight for every vertex.

The existing four-influence rigging/export rules still apply. Skinned native strokes, general IK, topology retessellation, automatic weights, smoothing and per-bone influence locks remain open. Painting operates on existing controls; it does not add vertices or change a triangle index/UV. Sparse controls can produce broad deformation changes, so inspect the animated result. This is not general Rive rigging parity.

## Original study

**Gust — a scarf in the breeze** adds a curved mint bird with a coral scarf and tiny woven panel. It has 27 editable nodes, three scarf bones, weighted vector edge/fill paths and a ten-vertex textured mesh. The single small PNG is generated original weave artwork; no reference stock pixels, supplied corpus art or external asset requests are used. The poster is an actual Evir Canvas render.

Select **flying scarf** and paint **scarf tip** to compare anchor/handle effects. Select **woven panel** to edit the mesh through the same interface. **Breeze** is a two-second loop with separate root/middle/tip rotation tracks. Source and compatible `.riv` ship with gallery inspection instructions. The [generator](../apps/web/weight-scene.mjs) uses the shared binding and normalized weight operations.

## Validation

```sh
node apps/web/generate-examples.mjs
EVIR_CAPTURE_EXAMPLE=gust EVIR_CAPTURE_EXAMPLES_ONLY=1 node tools/capture_site_assets.cjs
npm run test:runtime
npm run runtime:build
npm run test:frontend
npm run test:editor
npm run validate:editor
npm run test:web
npm run test:experience
```

`test:editor` includes normalized/atomic operation and swept-brush units plus the four-layout browser workflow. `validate:editor` includes `validate:weights`: original Gust and actual Studio edits are compared against official Rive Canvas/WebGL2 at named animation frames, with separate animation-free files for the rest geometry. Visible coverage is required; blank images cannot pass. The [scoped evidence directory](../research/results/skin-weights/) records fixture/asset hashes, runtime/browser versions, completed checks and actual screenshots.

The automated workflow covers numeric handle separation, invalid target rejection, whole-stroke undo/redo, cancellation/lifecycle, second-finger navigation, normalized mesh slots, native downloads, recovery and reachable sheets with automated accessibility checks. These are cloud Chromium/SwiftShader results, not physical GPU/mobile measurements, human usability or screen-reader certification.

The gallery oracle and character pixel-hash checks transfer raw RGBA buffers as base64 rather than per-pixel JavaScript arrays. Profiling the incomplete first gallery run found most sampled CPU time in Playwright protocol validation; that run was canceled without claiming a pass. A second run passed gallery and motorcycle checks before being canceled at the same higher-resolution transfer in the character suite. The final restarted suite retains the same pixels, SHA256 inputs, MAE/coverage calculations and thresholds, with explicit decoded-buffer length checks. The validation ledger distinguishes the application commit from both test-harness changes and records both incomplete attempts separately.

The contour-import increment remains separate in PR #36 while it is unmerged. This increment starts from current `main` and does not include those import changes or Tide. Further rigging/blending, broader editable import, path joining, text/layout, larger-project control virtualization and host orchestration remain on the consolidated plan.
