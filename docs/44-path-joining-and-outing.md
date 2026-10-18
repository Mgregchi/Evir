# Joining paths and Outing

18 October 2026. Studio now connects two existing open, unskinned paths with a straight segment or merges their chosen endpoints. This is an authoring operation over existing cubic geometry; there is no new source/runtime format, environment variable or hosting target. The single web host remains `apps/web`, with Studio at `/editor/studio/`. Physical tests stay postponed and hosted backend remains deferred.

## Research before implementation

[Retrieval provenance](../research/path-joining/sources.json) records primary-source URLs, response outcomes and hashes. Rive's [Edit Vertices](https://rive.app/docs/editor/fundamentals/edit-vertices) documents opening a path, reversing its direction and independent handles. Its [Pen guide](https://rive.app/docs/editor/fundamentals/pen-tool-overview) documents click/drag creation. Those sources do not establish cross-path joining behavior. The [Inkscape manual](https://inkscape-manuals.readthedocs.io/en/latest/node-operations.html) distinguishes merging nodes from connecting endpoints with a new segment. Evir exposes that distinction explicitly instead of guessing from endpoint proximity.

[WCAG dragging guidance](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) informs ordinary selectors and Apply/Cancel controls: this operation requires no drag gesture. The user's sheet preference determines presentation. The outline diagram, named endpoint selectors, bounded candidate list and explicit retained-layer identity are Evir product choices.

[WCAG use of color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html) calls for shape or text in addition to color. The kept endpoint uses a circle and the other endpoint a square, with an accessible name and visible legend. Completion uses a success toast.

## Workflow

1. In Design, select the open path whose layer ID, name, parent, transform and paint should stay. In **Properties → Connect paths**, choose **Join paths…**. Alternatively select two paths in Layers with Multiple or Shift; the first selected path is kept.
2. Choose **Other path**, **Kept endpoint** and **Other endpoint**. Normal candidates are the immediate neighboring path layers under the same parent. A preselected second path remains explicit even if it is incompatible; the sheet explains the rejection.
3. **Connect with a straight segment** retains both endpoint records and all existing curve segments. The previously unused handle on each selected endpoint becomes a corner for the new straight connection.
4. **Merge at the kept endpoint** retains that endpoint and removes the other endpoint's point ID. The donor endpoint's outgoing handle follows its movement. This can change its attached curve; all other original segments stay in place. A large gap is not automatically snapped or hidden.
5. Review the outline, endpoint markers, point count and gap in artboard units, then **Apply**. The preview shows authored geometry; it is not a paint/rendering oracle. Cancel changes no source. One Undo restores the two original layers; Redo restores the join. On compact screens, successful Apply closes the Properties drawer and returns focus to the stage. Cancel returns focus to the opener.

The sheet starts at its heading, supports ordinary keyboard selection and contains focus through the existing dialog framework. Actions remain reachable in short landscape layouts. It uses the existing sheet transitions and reduced-motion rules. Preview SVGs are replaced when options change; they schedule no animation frames and never enter recovery or `.riv` exports. Scope/revision/mode/selection changes invalidate Apply; a canceled sheet's detached callback cannot make an edit. Browser stale-selection coverage deliberately injects a background selection event, rather than claiming that users can click through a modal.

Each preview reads one source snapshot. Apply computes its validated join inside the history transaction without a duplicate preliminary plan. These are implementation bounds, not measured device performance.

Live tools revoke their local session when closed. This increment does not add concurrent Live pairing, remote MCP access or hosted services.

## Shared contract and limits

`@evir/authoring` exports `planPathJoin(project, keepId, otherId, options)` and `joinPaths(project, keepId, otherId, options)`. Options are `{keepEnd:'first'|'last', otherEnd:'first'|'last', mode:'bridge'|'merge'}`; defaults are Last, First and Bridge. Planning is pure. Joining validates the complete candidate document before replacing its node list, and returns the retained layer ID.

Both paths must be visible/unlocked through their ancestors, open, unskinned, adjacent siblings in one artboard. Joining does not silently delete path animation, listeners, clipping, feather or IK references: those direct references reject the operation. Animation on a shared parent may remain, since both pieces use that same parent space. Parent/group effects remain on their existing group. Layer order gaps are valid and are not renumbered.

Donor anchors and handles are converted into the kept path's coordinates with the full relative affine transform. Filled paths can bake a donor shear into their control coordinates. Strokes additionally require proportional relative scale without shear, matching effective width/color/cap/join, empty dashes and a full unoffset trim. Stroke width is compared after scale conversion. Solid fills must match, including alpha. Gradients require paint-space remapping and reject. Joining filled open paths can change their implicitly closed fill region; merging also changes the attached donor curve. These are deliberate topology edits, not a promise of identical painted pixels before and after.

The result has at most 4,096 points; transformed local coordinates must remain finite and within ±1,000,000. Existing point IDs remain, except the selected donor endpoint removed by Merge. Colliding point IDs, singular spaces, unsupported options and budget failures reject atomically. The native compiler retains its existing transform/render restrictions, including rejection of a retained local shear. No automatic smooth joining, arbitrary compound-contour editing, gesture concatenation or skinned joins are added.

## Original Outing study

**Outing — a line that finds its way** adds an original curved coral fox, cream cheeks, mint scarf and a two-color kite. Its string begins as two neighboring open stroked paths. The generator uses the shared join operation to produce the completed 36-node study; its 37-node starting project and a readable endpoint recipe are separate downloads. The recipe is a teaching aid, not another importer. Parent drift and a small eye blink demonstrate existing animation; no stock/reference pixels, fonts or modified brand artwork are used. The poster is an actual Evir Canvas render.

Open the starting source, select **kite string**, then Join paths. Choose **upper string**, Last → First and **Connect with a straight segment**. The preview reports a 24.083-unit gap and four finished points. Applying the published recipe reproduces the finished source/export exactly. Merge is an alternative with three finished points and a changed adjoining curve.

This branch starts from main `8efe5d2`. Contour import/Tide in PR #36 and graphical skin weights/Gust in PR #37 remain separate unmerged product increments. Outing is the 26th registered study on this branch. Two test-only raw-pixel transport corrections from PR #37 are reused: RGBA buffers cross Playwright as lossless base64, preserving all gallery comparisons and character SHA256 inputs while avoiding per-pixel protocol-object overhead. No product code from those PRs is required.

## Validation

```sh
node apps/web/generate-examples.mjs
EVIR_CAPTURE_EXAMPLE=outing EVIR_CAPTURE_EXAMPLES_ONLY=1 node tools/capture_site_assets.cjs
npm run test:runtime
npm run runtime:build
npm run test:frontend
npm run test:editor
npm run validate:editor
npm run test:web
npm run test:experience
```

Units sample original cubic segments in world coordinates for all four endpoint pairings and both methods, exercise relative affine conversion and proportional stroke width, and check history, source/native recovery, references, invalid inputs and bounds. Browser workflows cover 320/390 portrait, 844×390 landscape and 1440 desktop, preview isolation, focus, reachable controls, both methods, actual downloads, recovery, incompatible paint, explicit multiple selection and stale/canceled callbacks.

`validate:joining` checks the original finished/starting study and actual Studio bridge/merge exports at five named frames. Each also has a separate animation-free rest export, since the official high-level runtime initializes its first clip even when paused. The eight fixture pairs produce 48 official Canvas/WebGL2 comparisons, with visible coverage required, preset MAE < 2.5 and coverage difference < 350. [Scoped evidence](../research/results/path-joining/) records versions, hashes, completed commands and actual screenshots. Cloud Chromium/SwiftShader and automated accessibility are not physical-device, human or screen-reader certification.
