# Live shape controls

20 October 2026. Shapes created from the Studio palette now keep their preset controls by default. Choose **Create → Shapes…**, select a preset, adjust the preview and leave **Keep editable shape controls** checked. In Properties, resize it, change a rounded rectangle's corner radius, change a polygon's sides or change a star's points/inner radius. The supported bounds remain the same as the creation palette. A circle keeps equal width and height.

Choose **Convert to free path** before moving individual anchors and handles, inserting/removing points, continuing or joining a path. Undo restores the live definition. Compound operations produce free geometry. The downloadable **Nocturne starting shapes** includes two live circle windows: resize them before subtracting both from the owl body. The completed example has three independently animated components and actual transparent cutouts.

The project-model owns canonical preset geometry, shared by source validation and authoring. A source v3 `geometry.shape` stores `{type,options}`. Its points/dimensions must agree with those controls; a stale definition rejects rather than silently regenerating artwork on load. Paint and stroke settings remain independent. Fixed-topology edits keep stable point IDs and skin weights; changing a bound shape's point count requires unbinding it. Rectangle width/height animation must be removed before converting that rectangle to a free path. Shape controls themselves are Design controls rather than a new animation-property family.

Editable source retains these definitions through save/recovery. Runtime snapshots omit them, and `.riv` exports contain only resulting geometry. Native import returns free geometry, since inferring an author's preset from cubic contours would be an assumption. Existing callers of `addShape` remain static unless they explicitly request `parametric:true`.

The local command/MCP patch schema exposes `create_shape`, `set_shape_parameters`, `detach_shape`, `combine_paths`, `release_compound` and `join_paths`. Commands share authoring validation, artboard scope, ancestor locks, revision checks, retry handling and one atomic Undo step. Create a shape with an explicit stable `nodeId`, `preset` and `options`; use that ID in later commands. `create_node`/`update_node` also recognize advanced contour/winding/shape source requirements. Curve Boolean previews remain a Studio worker capability; the synchronous command surface does not claim an asynchronous Boolean service or hosted pairing.

```json
{"op":"create_shape","nodeId":"lesson-star","preset":"star","options":{"width":180,"sides":5,"inner":45,"parametric":true}}
```

```json
{"op":"set_shape_parameters","nodeId":"lesson-star","changes":{"sides":7,"inner":55}}
```

Research: the existing [shape/lesson study](46-shapes-and-first-animation.md) establishes native preset geometry. This increment keeps that geometry and makes its authoring definition persistent. [Compound geometry research](48-compound-paths-and-boolean-curves.md) describes the separate topology-changing workflow. The MCP tools specification in the [source ledger](../research/software-closure/sources.json) informs discovery schemas; it does not imply remote pairing is available.

[Live-shape unit tests](../tests/editor/parametric-shapes.test.mjs) check all presets, canonical validation, stable IDs, bound topology, atomic rejection/history and omission from runtime snapshots. [Responsive browser tasks](../tests/editor/parametric-shapes-browser.cjs) check source import, live settings, free-point editing, Undo/Redo, export and recovery at four viewport sizes. [Native pixel comparisons](../tools/validate-compounds.cjs) include all 14 resized live presets and the actual Studio star export. Cloud automation is not physical-device, moderated-beginner or screen-reader evidence.

## Smooth connections

**Join paths… → Connect with smooth tangents** now mirrors the two endpoint handles into the new connector. Existing cubic segments and anchors remain unchanged. A nonzero incoming/outgoing handle gives matching first derivatives at that junction; a collapsed handle uses one third of the connector chord as a useful curve start. It does not promise curvature continuity or remove self-intersections. Straight Connect and Merge retain their existing behavior. The preview shows the actual resulting curve before Apply.

**Continue path… → Smooth connection** uses the same connector rule for the first added segment. The live draft preview and finished geometry agree, including when continuing from the first endpoint. Cancel retains the source, and Finish remains one reversible edit. This is an explicit endpoint connection; automatic freehand gesture concatenation remains separate.

The implementation follows cubic control-point reflection described by [SVG path commands](https://www.w3.org/TR/SVG2/paths.html#PathDataCubicBezierCommands). Paper's documented smoothing methods were researched too; this narrowly changes unused endpoint handles instead of applying whole-path smoothing. Both primary retrievals are in the source ledger. The original Outing starting source can demonstrate all three Join modes. The local `join_paths` command accepts `options.mode:"smooth"`.
