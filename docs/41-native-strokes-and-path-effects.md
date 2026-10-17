# Native strokes and path effects

Research and implementation: 16 October 2026. This increment starts from `origin/main` at `087ed17`, which includes merged PRs #33 and #34. It adds native centerline paint; the pressure brush remains available as an editable filled outline. Hosting remains the single `apps/web` app importing independent Studio and engine packages.

## Research, observations and choices

[Retrieval provenance](../research/native-strokes/sources.json) records successful/failed requests, hashes and upstream versions. [Rive Fill and Stroke](https://rive.app/docs/editor/fundamentals/fill-and-stroke) describes separate paints and stroke cap/join controls. Rive supports more paint combinations than this increment. Its current documentation is a reference, not evidence that every advertised feature is compatible with our pinned runtime.

The pinned runtime's `Stroke` chooses local paths when `transformAffectsStroke` is true. `StrokeCap` maps butt/round/square to 0/1/2; `StrokeJoin` maps miter/round/bevel to 0/1/2. The pinned `TrimPathMode` header defines sequential as **1**, synchronized as 2. An exploratory mode value of 0 caused a native file-load failure; the corrected encoder is checked against both official JavaScript backends at version 2.44.0.

`TrimPath` sorts reversed start/end values, wraps offset in turns and can reconnect a closed contour across its seam. `DashPath` wraps an artboard-unit offset around the measured path and walks alternating lengths. That behavior differs from simply assigning the same phase to Canvas `setLineDash`. Evir therefore constructs these effects explicitly, in trim-then-dash order. The [software implementation](../packages/renderer-canvas/stroke.mjs) retains cubic source controls and adaptively flattens only effect output. It is bounded approximation, not a claim to duplicate Rive's curve-measuring implementation.

The existing user preference determines bottom-sheet presentation. WAI dialog guidance informs contained focus, Escape and focus return; existing reduced-motion styles disable sheet movement. No native alert/confirm/prompt or browser form-validation popup is introduced.

## Create and edit

1. In Design, select an ordinary unskinned path or rectangle. Open **Properties → Add stroke** or **Edit stroke**.
2. Set width (0–256 local units), hex RGBA color, cap and join. **Shape fill → No fill** leaves an open or closed centerline; **Keep fill** paints the stroke over the fill.
3. Enter paired dash/gap lengths, for example `18, 10`, or leave empty for a solid line. Dash offset uses shape-local units and Rive path-length wrapping.
4. Trim start/end use fractions 0–1. Offset uses turns from -1 to 1. Reversed start/end values use the interval between them; equal values draw nothing.
5. Apply commits one undo step. Cancel/Escape discard the draft. Errors remain inside the sheet. Existing fill or stroke tracks must be removed before removing their paint; removing the last paint is rejected.

**Freehand → Drawing options → Centerline stroke** creates a constant-width open curve whose paint stays editable after Finish. The drawing width is in local units and follows the chosen parent transform. Width, cap, join, dash and trim remain independent of its control points. Use **Brush outline** when variable pen pressure matters: that mode continues to bake width into filled outline points. Native centerlines currently have no pressure-width profile.

**Animate** exposes `stroke.width`, `stroke.color`, `stroke.trimStart`, `stroke.trimEnd`, `stroke.trimOffset` and, for dashed paint, `stroke.dashOffset` in Key property. Set a key, select it in the timeline, then edit Key value/easing. Structural paint changes stay in Design. Numeric stroke easing value handles, including stroked rectangle dimensions, must remain within 0–1 so in-between values stay within their declared ranges. These properties participate in Evir evaluation, machine pose mixing, independent property-scoped playback and native keyed export.

Layer selection, stage hit testing, conservative paint bounds, source save/recovery, endpoint continuation and local command patches preserve the stroke. Existing `create_node`/`update_node` commands can carry its validated geometry and `set_key` can key supported stroke properties. Local hosts retain their separate sessions; this adds no remote pairing/backend service.

## Source, runtime and native contracts

A rectangle/path may carry `geometry.stroke`:

```json
{
  "color": "#284d40ff",
  "width": 8,
  "cap": "round",
  "join": "round",
  "dash": [18, 10],
  "dashOffset": 0,
  "trim": { "start": 0, "end": 1, "offset": 0 }
}
```

It requires source v3/runtime v2. `geometry.fill` can be `null` only when a valid stroke is present. Previous solid/gradient projects remain unchanged and keep their existing export bytes. Earlier readers reject the extension; there is no implicit conversion of unsupported paint to a fill.

The compiler emits a native `Stroke` plus `SolidColor`, optional `TrimPath` (sequential mode 1), and optional `DashPath`/ordered `Dash` children. Width/color/effect keys target those actual components. Fill is emitted first when present, then Stroke. Paint width follows local transforms, including nonuniform scale/reflection. Centered strokes use a miter limit of 4 in the software renderer. Authored dashes are isolated from caller Canvas dash styles; drawing restores those caller settings.

Semantic import supports this same native subset, including animation and fill-plus-stroke shapes. It rejects percentage dashes, noncentered/non-scaling/gradient strokes, unknown cap/join values, extra paints, stroke-before-fill paint order, unsupported effect order/mode/parenting and unsupported resource/scene features. This expands editable import without making arbitrary Editor files editable. Float32 and trigonometric reconstruction may change canonical bytes on import; semantic geometry is checked with numeric tolerances. Original-file viewing remains available for files outside this subset.

## Original example and verification

**Trace — a little delivery** adds an original courier bird, postcard, paper plane and animated flight trail. Its editable layers demonstrate fill-plus-stroke artwork, round/square caps, bevel joins, postage dashes, changing width/color and a trimmed drawing loop. The [generator](../apps/web/stroke-scene.mjs), source, `.riv`, actual renderer-captured poster and gallery inspection instructions ship together. The reference images supplied earlier are not traced or redistributed in this example.

Run:

```sh
npm run test:runtime
npm run runtime:build
npm run test:editor
npm run validate:editor
npm run test:frontend
npm run test:web
npm run test:experience
```

`validate:editor` now includes `validate:strokes`, whose focused native comparisons cover caps, joins, transformed/reflected paint, positive/negative dash phases, open/closed and wrapping/reversed trim, combined effects, zero width and animated width/color/trim/dash offset. Separate animation-free exports check static authoring geometry: the official high-level host initializes the first animation when none is selected, so its default pose is not a static-source oracle. The [browser workflow](../tests/editor/stroke-browser.cjs) checks five viewport sizes, sheet reachability, invalid input, cancellation/focus, one-step history, native download, browser recovery, editable `.riv` import and drawing a retained centerline. Results and actual screenshots live under [native-strokes](../research/results/native-strokes/); the validation ledger records completed commands and environment provenance.

## Limits and next work

One centered solid stroke and one optional fill are supported per unskinned shape. Stroke feathering, gradient strokes, skinned stroke geometry, inside/outside alignment, non-scaling paint, variable-width native strokes, multiple paints, percentage dashes and other effect orders remain open. Dash patterns contain zero or up to 16 paired lengths, each 1–16,384 local units. Stroked paths have at most 256 points and a control-polygon length budget of 16,384 local units (including the maximum keyed rectangle dimensions); generated effect contours have a 65,536-point guard. Width zero is invisible, but the source centerline remains selectable through Layers.

Effect approximation uses cubic control-polygon excess ≤0.01 local units and chords ≤8 units, with depth 12. Bounds conservatively include caps/miters; they are not exact visible-pixel bounds. Selected screenshot comparisons do not establish full renderer parity. General path joins/gesture concatenation, broader editable Editor import, advanced rigs/blends and rich text/layout remain subsequent work. All physical testing stays postponed; human/assistive-technology evidence remains open and hosted backend work remains deferred.
