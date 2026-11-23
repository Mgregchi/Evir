# Editable native contours and Tide

Research and implementation: 17 October 2026. This extends the existing bounded `.riv` importer. The single hosted web app, Studio package and engine boundaries are unchanged. Physical tests remain postponed; hosted backend services remain deferred.

## Research and decisions

[Primary-source retrieval provenance](../research/import-geometry/sources.json) records the pinned runtime commit, successful requests, hashes and one failed source URL. The generated schema and C++ implementations were read before implementing the mapping. Rive's [Edit Vertices](https://rive.app/docs/editor/fundamentals/edit-vertices) documentation distinguishes straight, mirrored, detached and asymmetric handles and describes vertex editing in Design and Animate. That documents Rive's capabilities; it does not establish Evir animation parity.

The [supplied-corpus geometry inventory](../research/import-geometry/corpus-geometry.json) finds 842 mirrored vertices, 412 asymmetric vertices and 360 ellipses in SOBO. These are useful targets for import research. SOBO still rejects editable import because its data contracts and other features exceed the declared subset. Type counts are not evidence of successful whole-file conversion, matched scenes or an artwork redistribution license.

Mirrored/asymmetric incoming controls subtract their direction vector; detached incoming controls add their separately stored vector. Ellipses default to a centered origin and use four clockwise cubic vertices with `circleConstant = 0.552284749831`. Static transforms on unskinned contours act in the shape's local geometry space. Skinned paths use the bind-space rules below.

Evir materializes supported geometry as ordinary editable cubic controls. This preserves the rendered geometry, supported paints and bone/shape motion. It does not retain the procedural ellipse or mirrored/asymmetric editing constraint: after import, each handle can move independently. Runtime component IDs become new source IDs, as in the existing importer.

## What imports

| Native geometry | Editable result | Limits |
| --- | --- | --- |
| Mixed `StraightVertex`, `CubicMirroredVertex`, `CubicAsymmetricVertex`, `CubicDetachedVertex` in one `PointsPath` | Ordered anchors and independent incoming/outgoing handles, retaining open/closed state | Static straight-vertex radii are supported on unskinned paths. Contour and vertex geometry keys reject. |
| `Ellipse` | Four-point closed cubic path, preserving width, height and origin geometry | Positive dimensions; static geometry only. The original parametric dimensions are not Inspector properties after conversion. |
| `Rectangle` with rounding, centered/custom origin or contour transform | Closed path in shape-local coordinates with editable corner controls | Positive dimensions and static contour geometry. |
| `Triangle`, `Polygon` and `Star` | Closed editable paths with static origins, transforms, star inner radii and polygon/star corner rounding | Positive dimensions and static geometry. Evir accepts 3–256 polygon sides or star tips. |
| Square-cornered top-left rectangle with identity contour transform | Existing rectangle node | Existing width/height animation remains supported. |
| Static contour translation, rotation and scale | Applied to every anchor and handle, leaving the Shape transform and paint coordinates intact | Unskinned contours only; animated contour transforms reject. |
| Skinned mixed-vertex path with static contour transform fields | Existing path skin with the original local controls and explicit bind matrix | Straight `Weight` influences apply equally to the coincident anchor and handles; cubic vertices require `CubicWeight` with independent control influences. Existing influence/rig limits still apply. |

Supported Shape/group/bone transforms, fill/gradient/color animation and the existing centered solid stroke contract continue to use their existing mappings. A shape still needs exactly one supported contour and the supported paint combination. Static contour conversion does not broaden stroke, clipping, feather, asset, data-binding or state-machine contracts.

Unsupported geometry keys reject before project replacement and now receive an **animated contour geometry** explanation. Evir does not sample or discard their motion to force an editable import. Skinned rounded freeform vertices, unknown path flags, and counterclockwise flags combined with clockwise fills still reject. Malformed contour/vertex/skin/weight parenting and duplicate skins reject explicitly.

### Static corner rounding

Rive's pinned [Rectangle implementation](https://github.com/rive-app/rive-runtime/blob/7aa93402a27c800db8a36acc8672612c100ea9b1/src/shapes/rectangle.cpp) visits the corners clockwise from top left. Its [generated defaults](https://github.com/rive-app/rive-runtime/blob/7aa93402a27c800db8a36acc8672612c100ea9b1/include/rive/generated/shapes/rectangle_base.hpp) link all corners to the top-left radius unless linking is explicitly disabled. The pinned [Path implementation](https://github.com/rive-app/rive-runtime/blob/7aa93402a27c800db8a36acc8672612c100ea9b1/src/shapes/path.cpp) clamps each radius magnitude to half the shorter adjacent edge, computes cubic handles, and rotates those handles for negative radii.

Evir converts each rounded corner to two editable points before applying the contour transform. Linked radii, zero-radius corners, independent concave corners and oversized radii follow that same geometry. Radius and linking controls are baked into the imported path. Native radius animation still opens through the original-file viewer.

For freeform straight vertices, Rive measures from the corner to the previous cubic's outgoing handle and the next cubic's incoming handle, using the adjacent anchors for straight neighbors. It clamps the radius by half both distances and wraps the neighbor lookup even at open-path endpoints. Evir uses the same construction to bake positive and negative radii into editable controls while preserving whether the contour is open. Skinned rounding stays unsupported because the native curve is rebuilt from deformed neighboring controls.

### Skinned contour space

The pinned [PointsPath implementation](https://github.com/rive-app/rive-runtime/blob/7aa93402a27c800db8a36acc8672612c100ea9b1/src/shapes/points_path.cpp) supplies an identity composition transform for skinned paths. [Skin](https://github.com/rive-app/rive-runtime/blob/7aa93402a27c800db8a36acc8672612c100ea9b1/src/bones/skin.cpp) loads its explicit bind matrix and deforms vertices with the weighted bone transforms. Evir keeps the local anchors and handles, the bind matrix, and the independent control weights. Static translation, rotation, and scale fields on the skinned path itself are normalized away on re-export because they do not place the native deformed geometry. Animated contour properties still fall outside the editable contract.

### Procedural triangle, polygon and star contours

In the pinned runtime, triangles place the tip at the top center and the base at the lower extent. Polygons start at the top of an ellipse determined by width and height. Stars alternate outer and inner points along that ellipse. Polygon and star corners use the same native straight-vertex rounding covered above. [Triangle source](https://github.com/rive-app/rive-runtime/blob/7aa93402a27c800db8a36acc8672612c100ea9b1/src/shapes/triangle.cpp) · [Polygon source](https://github.com/rive-app/rive-runtime/blob/7aa93402a27c800db8a36acc8672612c100ea9b1/src/shapes/polygon.cpp) · [Star source](https://github.com/rive-app/rive-runtime/blob/7aa93402a27c800db8a36acc8672612c100ea9b1/src/shapes/star.cpp)

Evir materializes the contours as detached controls, with a 256-side or 256-tip limit to bound generated geometry. The native sample retains the procedural fields. Animated procedural properties still use the original-file viewer.

### Counterclockwise flags on ordinary paths

Evir accepts the native counterclockwise hint on contours with nonzero or even-odd fills or strokes. It preserves the vertex order and handles. Rive uses the authored contour directly for these paints and for its world-path clipping. Its separate clockwise-fill compositor can use the flag to reverse contours, so that combination still opens through the original-file viewer. Evir re-export writes the editable geometry with canonical path flags. [Flag definitions](https://github.com/rive-app/rive-runtime/blob/7aa93402a27c800db8a36acc8672612c100ea9b1/include/rive/shapes/shape_path_flags.hpp) · [Path composer](https://github.com/rive-app/rive-runtime/blob/7aa93402a27c800db8a36acc8672612c100ea9b1/src/shapes/path_composer.cpp) · [Fill source](https://github.com/rive-app/rive-runtime/blob/7aa93402a27c800db8a36acc8672612c100ea9b1/src/shapes/paint/fill.cpp)

### Hidden contours

Rive excludes hidden paths from local and world composition and skips fully hidden shapes as clipping sources. Evir retains the original control points and skips hidden contours in fill, stroke and clip geometry. In Studio, select the contour in Path controls and use **Show contour** or **Hide contour**. Undo restores the previous state. The visibility travels with the renderable geometry through editable source, runtime snapshots and native re-export. [Path composer](https://github.com/rive-app/rive-runtime/blob/7aa93402a27c800db8a36acc8672612c100ea9b1/src/shapes/path_composer.cpp) · [Clipping source rules](https://github.com/rive-app/rive-runtime/blob/7aa93402a27c800db8a36acc8672612c100ea9b1/src/shapes/clipping_shape.cpp)

## Try Tide

**Tide — a shore-side hello** adds Pebble, an original mint seal on a sea-glass shoreline. Thirty-five named editable layers include a waving flipper, whiskers, shell, sun, muzzle and eye highlights. **Shore hello** is a two-second looping body bob and flipper wave. No image/font assets or supplied reference pixels are embedded.

The [native recipe](../apps/web/import-scene.mjs) contains actual ellipse, square-cornered and rounded rectangle, straight, mirrored and asymmetric records. The generator encodes those records independently of `compileProject`, imports that native file, assigns reproducible source IDs and compiles the editable result. The poster is an actual Evir Canvas capture. This is an original synthetic native study, **not an export produced by the Rive Editor**.

1. In the website's Examples page, find **Tide** and download **Native import sample** (`tide-native.riv`).
2. Open it in Studio through **Open project** and confirm replacement after saving any existing work.
3. Select **soft silhouette**, open **Properties → Edit points**, then change a point or handle. Undo restores the imported geometry. Select **muzzle** to inspect an ellipse converted to four cubic vertices, **mint sea glass** for a rounded rectangle with a counterclockwise cutout and a hidden ellipse on Contour 3, or **far tide** for rounded freeform corners, or **cream sea star** for a rounded star.
4. Choose **Animate**, open **Timeline** on compact screens and scrub **Shore hello**. The body bobs while the flipper pivot drives the imported skin.
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

Broader editable Editor-file import remains open: animated geometry, skinned freeform rounding, clockwise-fill winding, broader compound contours, layout/data contracts, nested artboards, richer machines and asset/text semantics require separate contracts and fixtures. Graphical weight painting, richer rigging/blending, path joins and text/layout also remain on the consolidated plan.
