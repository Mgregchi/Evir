# Compound paths and curve Boolean operations

Research and implementation: 20 October 2026. [The closure ledger](47-software-closure.md) tracks the broader authorized work. This feature closes the earlier single-contour restriction with a shared source/render/import/export contract.

## Research and choices

[Retrieved primary sources](../research/software-closure/sources.json) include Paper's PathItem Boolean documentation, SVG winding rules and the pinned Rive path/trim implementations. Paper 0.14 is pinned and MIT licensed. It preserves cubic curves through Union/Subtract/Intersect/Exclude; the examined polygon-clipping alternative outputs polygonal boundaries. The optional kernel has a separate authoring entry and runs in a disposable browser worker. It adds no hosted service or startup requirement.

## Authoring

Select two to eight filled rectangles/paths in Layers using Multiple, then Properties → Shape operations. Choose which layer's appearance to keep and the operation; Preview result runs off-thread. Review the transparent outline and Apply. Combine contours retains the curves without a Boolean operation, using the chosen winding rule. Cancel changes no source. Each apply is one history edit; Undo restores every original layer.

The kept layer retains its ID, parent, transform and paint. Other selected layers disappear. Inputs must share a parent/artboard and be visible/unlocked; direct keys, listeners, skin and references from clips/feathers/IK require removal before topology changes. Group animation can stay. A mathematically empty result removes the selection with undo available. Inputs are bounded to 1,024 controls/64 contours; results to 4,096 controls/256 contours. Previews have a five-second cancellation watchdog and terminate their worker when completed or closed.

Choose Contour in Path controls to edit a second or later outline using the same numeric/pointer tools. Nonzero and even-odd fill rules are explicit. Release contours creates separate layers at the same stacking position; holes become filled shapes, and Undo restores the compound. Shared compound skin bindings are supported; native import rejects mixed bound/unbound contours or incompatible bind spaces rather than dropping them.

## Shared contracts

The original `geometry.points` / `closed` remain the first contour. Optional `contours` entries each contain their own points/closure; optional `fillRule` is `nonzero` or `evenodd`. Compounds use source v3/runtime v2. Point IDs remain globally unique, and skin validation covers all controls. `pathContours`, `pathPoints` and `pointContour` are shared model helpers. Clip records can explicitly select a fill rule independently of the mask's painted fill.

Canvas drawing, hole hit testing, bounds, strokes/effects and point/weight controls traverse all contours. Native export emits several PointsPaths under one Shape and one paint, with the matching winding rule and per-contour skin records. Editable import reconstructs independent contours rather than discarding all but one. Existing single-contour exports retain their bytes.

`@evir/authoring` exposes `prepareCompound`, `commitCompound`, `combinePaths` and `releaseCompound`. `@evir/authoring/boolean` exposes the optional `booleanGeometry` / `booleanPaths`; its standalone distribution is `dist/boolean.mjs` with `LICENSE.paper`. The ordinary standalone authoring entry does not import the kernel.

## Example and evidence

Nocturne is original vector art: an owl with curved eye windows and a crescent, 28 named layers and separate wing/body motion. The downloadable starting shapes reproduce the body cutouts through the same Studio operation. Its poster is captured from the actual renderer.

[Compound evidence](../research/results/software-closure/compounds/) includes responsive browser workflows at 320/390 portrait, 844×390 landscape and 1440 desktop, actual source/native downloads, independent native input, hashes and official Rive 2.44 Canvas/WebGL2 comparisons. Checks cover transparent hole hit testing, secondary-contour editing, preview/cancel, terminated workers, one-step undo/redo, recovery and automated accessibility. Native cases cover each Boolean operation, both fill rules, strokes/effects, clipping, shared skins/reimport and the example.

Cloud graphics and automated accessibility do not establish device performance, screen-reader usability or beginner usability. Physical tests remain postponed and hosted backend work remains deferred.
