# Static gradient paints — research, contract and acceptance

Implemented 11 October 2026, following the consolidated authoring plan. This increment adds static linear/radial fills to rectangles and unskinned cubic paths in shared model, Canvas renderer, `.riv` compiler and Studio. The original **Dawn** study demonstrates the contract. Clipping, feathering, gradient-key animation and skinned paint deformation remain open.

## Research before implementation

[Retrieval provenance](../research/studio-gradients/sources.json) records primary-source URLs, outcomes, sizes and hashes. MDN's [linear gradient](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/createLinearGradient) and [radial gradient](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/createRadialGradient) references establish the current coordinate-space semantics and two-circle Canvas radial API. Rive's [linear paint implementation](https://github.com/rive-app/rive-runtime/blob/main/src/shapes/paint/linear_gradient.cpp), [radial implementation](https://github.com/rive-app/rive-runtime/blob/main/src/shapes/paint/radial_gradient.cpp), gradient-stop generated properties and the compiler's already pinned schema establish parent-linked paint/stop objects and a radial center/radius derived from the distance between endpoints. Rive also has world/deformed paint paths; this increment does not implement those broader semantics.

The attempted Rive Editor paint URL returned 404 and supplied no UI evidence. Existing sheet/interaction research in [workspace navigation](25-studio-navigation-and-remaining-work.md) and the user's explicit bottom-sheet preference determine the Inspector presentation. Stop budgets, static-only scope, unique positions and numeric endpoint controls are Evir product choices, not claims about Rive Editor limitations.

## Declared model and export contract

`geometry.fill` accepts the existing `#RRGGBB`/`#RRGGBBAA` string or:

```json
{
  "type": "linear",
  "start": [0, 0],
  "end": [120, 100],
  "stops": [
    { "position": 0, "color": "#f5e4ca" },
    { "position": 0.4, "color": "#e9b49580" },
    { "position": 1, "color": "#254131" }
  ]
}
```

`radial` uses Start as its center and the distance to End as its radius. All endpoints are finite shape-local coordinates and must be distinct. Stops number 2–16, have strictly increasing positions within 0–1 and validated hex colors including alpha. Colors extend outside the outer stops using the supported backends' default clamp behavior. Equal-position hard stops, other gradient kinds, extra fields and unsupported paint parameters reject rather than disappear. The 16-stop budget bounds sheet and export work for this first contract; it is not an upstream format limit.

This extends the early source **v2** / runtime snapshot **v1** vocabulary. Existing solid documents and source-v1 migration remain unchanged; source-v1 gradients reject. Earlier Evir validators reject gradient objects instead of silently substituting a solid fill. This is not backward-readable by those earlier packages, a new binary format, or universal `.riv` compatibility. Independent package release discipline should version this expanded vocabulary when packages are published.

Static paint follows its shape's transform, including parent transforms, reflection and unequal scaling. Gradient paths are constructed and painted under the same local Canvas transform; the pre-existing skinned solid path continues to use world-space controls. Gradient paint on a skinned path rejects explicitly. The compiler emits a single LinearGradient/RadialGradient mutator beneath Fill and GradientStop children beneath that gradient, with RGBA converted to Rive's ARGB color integer and coordinates checked for float32 export range. The pinned schema remains independent of research-server requests.

A gradient shape can animate supported transform/dimension properties. Gradient coordinates and stops are static; a dimension key does not automatically rescale local paint endpoints. Solid fill-color tracks remain supported. Converting a color-keyed shape to gradient requires removing its fill tracks deliberately; the validator and UI reject conflicting conversion. Rectangle-to-path conversion retains paint and IDs. Editor cameras, panel state and paint drafts never enter runtime exports.

## Studio workflow

Select a rectangle or unskinned path in Design and choose **Edit fill** in Properties. The bottom sheet has Solid / Linear / Radial type, local endpoints, stop positions/colors and per-color opacity. Add stop bisects the widest existing gap; removing stops retains the minimum two. Apply sorts the draft's unique stop positions, validates the full candidate and commits one undo step. Cancel/Escape discards all draft changes. Invalid values show custom feedback in the sheet and retain the previous valid artwork. A shape changed since opening requires reopening instead of silently replacing its paint.

Solid fills keep the existing quick color field, including Animate-mode color recording. Paint conversion is a Design operation. Locked shapes cannot open paint editing. Native dialog focus containment backs the bottom-anchored presentation; focus returns to Edit fill after Apply/Cancel, including when its Inspector was rerendered. Existing sheet transitions honor reduced motion. Endpoint handles on the canvas, live draft previews and animated stop authoring are later improvements; the current numeric controls work without dragging.

**Dawn** is the eighth original public study: a linear sky, radial sunrise under unequal group scale, and curved hills with local linear paint. Its Rise loop moves/rotates the sun without changing stops. [Editable source](../apps/web/assets/examples/dawn.evir-project), [compatible export](../apps/web/assets/examples/dawn.riv) and [real rendered poster](../apps/web/assets/dawn-poster.png) are tracked together; the gallery loads it only when near view and opens it in Studio.

## Acceptance and evidence

[Paint unit tests](../tests/editor/paint.test.mjs) exercise source/runtime loaders, atomic rejection, unknown fields, stop/alpha/coordinate budgets, version boundaries, skin/key conflicts, rectangle conversion, one-step history and deterministic compiler/float32 rejection. [Browser acceptance](../tests/editor/paint-browser.cjs) exercises real sheet editing at widths 320, 390, 844, 1024 and 1440; the 844-wide case has a 390-pixel landscape height. It checks invalid-draft isolation, endpoints/type/stops/opacity, Apply/undo/redo, Escape/cancel, returned focus, path controls, saved source, downloaded export bytes, overflow and automated accessibility.

The same test emits a fixture containing linear/radial rectangles and paths, multicolor/alpha stops, a rotated unequal-scale parent and a reflected path. Actual official Rive **2.44.0** Canvas2D and WebGL2 renders are compared against evaluated Evir pixels at rest and during parent rotation. The comparison retains the existing mean-absolute-error limit of 2.5 channel values rather than loosening it for gradients. The full gallery additionally tests Dawn's animation at four frames/backend and unchanged source-to-export downloads for every study. Existing authoring, engine, web and accessibility gates remain regression checks.

Evidence is under [studio-gradients](../research/results/studio-gradients/): source/export fixture, browser report, mobile sheet screenshot and validation ledger. These are cloud Chromium/software-graphics and automated checks. They do not establish physical mobile/GPU performance, matched Rive Editor-produced scenes, human usability or screen-reader acceptance; the user's device audit remains deferred. Remaining systems and the live agent proposal are tracked separately in [the current plan](25-studio-navigation-and-remaining-work.md) and [backend/live sessions](29-backend-and-live-agent-sessions.md).
