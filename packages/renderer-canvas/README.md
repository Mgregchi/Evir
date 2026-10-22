# @evir/renderer-canvas

Canvas2D backend for Evir scene poses. `CanvasRenderer(context).draw(pose, artboardId)` clears and clips the drawing surface, fits the artboard and draws runtime artwork. Hosts own the canvas and schedule playback. Low-level `drawScene`, geometry bounds and path helpers also support Studio overlays.

The backend supports solid/linear/radial paints, compound cubic contours and winding, weighted path controls, centered strokes/effects, embedded PNG images/meshes, single-line embedded-font text, clipping and approximate outer feather. Prepare embedded resources before drawing and dispose them on teardown. Authoring state stays outside runtime exports.

See [advanced 2D contracts](../../docs/30-advanced-2d-authoring.md), [compound contours](../../docs/48-compound-paths-and-boolean-curves.md) and [gradient/skinned strokes](../../docs/50-gradient-and-skinned-strokes.md) for workflows, tested native comparisons and precise limits. Dash/trim geometry is a bounded polyline approximation; outer feather is an approximation. Inner feather, full renderer parity, a custom GPU backend and arbitrary editable Rive import remain separate work.
