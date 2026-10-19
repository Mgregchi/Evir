# Editable native contours and Tide

Research and implementation: 17 October 2026. This extends the existing bounded `.riv` importer. The single hosted web app, Studio package and engine boundaries are unchanged. Physical tests remain postponed; hosted backend services remain deferred.

## Research and decisions

[Primary-source retrieval provenance](../research/import-geometry/sources.json) records the pinned runtime commit, successful requests, hashes and one failed source URL. The generated schema and C++ implementations were read before implementing the mapping. Rive's [Edit Vertices](https://rive.app/docs/editor/fundamentals/edit-vertices) documentation distinguishes straight, mirrored, detached and asymmetric handles and describes vertex editing in Design and Animate. That documents Rive's capabilities; it does not establish Evir animation parity.

The [supplied-corpus geometry inventory](../research/import-geometry/corpus-geometry.json) finds 842 mirrored vertices, 412 asymmetric vertices and 360 ellipses in SOBO. These are useful targets for import research. SOBO still rejects editable import because its data contracts and other features exceed the declared subset. Type counts are not evidence of successful whole-file conversion, matched scenes or an artwork redistribution license.

Mirrored/asymmetric incoming controls subtract their direction vector; detached incoming controls add their separately stored vector. Ellipses default to a centered origin and use four clockwise cubic vertices with `circleConstant = 0.552284749831`. Static contour transforms act in the shape's local geometry space. Skinned paths use a different transform contract, so transformed skinned contours remain rejected in this increment.

Evir materializes supported geometry as ordinary editable cubic controls. This preserves the rendered geometry, supported paints and bone/shape motion. It does not retain the procedural ellipse or mirrored/asymmetric editing constraint: after import, each handle can move independently. Runtime component IDs become new source IDs, as in the existing importer.

## What imports

| Native geometry | Editable result | Limits |
| --- | --- | --- |
| Mixed `StraightVertex`, `CubicMirroredVertex`, `CubicAsymmetricVertex`, `CubicDetachedVertex` in one `PointsPath` | Ordered anchors and independent incoming/outgoing handles, retaining open/closed state | Straight-vertex radius must be zero. Contour and vertex geometry keys reject. |
| `Ellipse` | Four-point closed cubic path, preserving width, height and origin geometry | Positive dimensions; static geometry only. The original parametric dimensions are not Inspector properties after conversion. |
| `Rectangle` with centered/custom origin or contour transform | Four-corner closed path in shape-local coordinates | Positive dimensions, zero corner radii, static geometry. |
| Top-left rectangle with identity contour transform | Existing rectangle node | Existing width/height animation remains supported. |
| Static contour translation, rotation and scale | Applied to every anchor and handle, leaving the Shape transform and paint coordinates intact | Unskinned contours only; animated contour transforms reject. |
| Identity-transform skinned mixed-vertex path | Existing path skin with the corresponding point references | Straight `Weight` influences apply equally to the coincident anchor and handles; cubic vertices require `CubicWeight` with independent control influences. Existing influence/rig limits still apply. |

Supported Shape/group/bone transforms, fill/gradient/color animation and the existing centered solid stroke contract continue to use their existing mappings. A shape still needs exactly one supported contour and the supported paint combination. Static contour conversion does not broaden stroke, clipping, feather, asset, data-binding or state-machine contracts.

Unsupported geometry keys reject before project replacement and now receive an **animated contour geometry** explanation. Evir does not sample or discard their motion to force an editable import. Unsupported rounding, nondefault path flags, compound contours, procedural polygons/stars/triangles and transformed skinned paths still reject. Malformed contour/vertex/skin/weight parenting and duplicate skins reject explicitly.

## Try Tide

**Tide — a shore-side hello** adds Pebble, an original mint seal on a sea-glass shoreline. Thirty-four named editable layers include a waving flipper, whiskers, shell, sun, muzzle and eye highlights. **Shore hello** is a two-second looping body bob and flipper wave. No image/font assets or supplied reference pixels are embedded.

The [native recipe](../apps/web/import-scene.mjs) contains actual ellipse, centered rectangle, straight, mirrored and asymmetric records. The generator encodes those records independently of `compileProject`, imports that native file, assigns reproducible source IDs and compiles the editable result. The poster is an actual Evir Canvas capture. This is an original synthetic native study, **not an export produced by the Rive Editor**.

1. In the website's Examples page, find **Tide** and download **Native import sample** (`tide-native.riv`).
2. Open it in Studio through **Open project** and confirm replacement after saving any existing work.
3. Select **soft silhouette**, open **Properties → Edit points**, then change a point or handle. Undo restores the imported geometry. Select **muzzle** to inspect an ellipse converted to four cubic vertices.
4. Choose **Animate**, open **Timeline** on compact screens and scrub **Shore hello**. The body and flipper keep separate transform tracks.
5. Save editable `.evir-project` source or export the compatible `.riv`. The gallery's ordinary **Download .riv** is the Evir re-export; **Native import sample** retains the original native contour types.

For unsupported files, the original read-only Rive viewer and original-byte download remain available. `.rev` authoring history is not reconstructed.

## Reproduction and evidence

```sh
node apps/web/generate-examples.mjs
EVIR_CAPTURE_EXAMPLE=tide EVIR_CAPTURE_EXAMPLES_ONLY=1 node tools/capture_site_assets.cjs
npm run test:runtime
npm run runtime:build
npm run test:frontend
npm run test:editor
npm run validate:editor
npm run test:web
npm run test:experience
```

`test:editor` includes the new compact/desktop native-import workflow. `validate:editor` includes `validate:imports`. The focused oracle starts from independently encoded native records, compares the imported Evir render with the original in official Rive Canvas/WebGL2, and separately compares the native re-export with the original. It covers mixed/default handles, open stroke paths, reflected/nonuniform contour transforms, local gradients, origins, shape animation, independent skin control bindings and Tide. Every pose must contain visible geometry; equality between empty renders cannot pass.

The [scoped results directory](../research/results/import-geometry/) contains source/native/re-export hashes, selected frame comparisons, actual Studio screenshots and the completed validation ledger. Numeric reconstruction uses float32/trigonometric tolerances rather than promising byte-identical native round trips. Chromium/SwiftShader checks are cloud software evidence, not physical GPU/mobile performance or human/screen-reader testing.

Broader editable Editor-file import remains open: animated geometry, rounding/path flags, compound contours, layout/data contracts, nested artboards, richer machines and asset/text semantics require separate contracts and fixtures. Graphical weight painting, richer rigging/blending, path joins and text/layout also remain on the consolidated plan.
