# @evir/renderer-canvas

Canvas2D backend for Evir scene poses. `CanvasRenderer(context).draw(pose, artboardId)` clears and clips the drawing surface, fits the artboard and draws runtime artwork. Hosts own the canvas and schedule playback. Low-level `drawScene`, `world`-geometry bounds and path-context helpers also support Studio's authoring overlays. Solid rectangles, cubic fills, skinned path controls and static shape-local linear/radial gradients on rectangles and unskinned paths are supported; gradient stop animation, clipping authoring, raster/text assets and a custom GPU backend remain future work. See [the shared-package guide](https://github.com/Mgregchi/Evir/blob/main/packages/README.md).

Advanced 2D contracts, source/runtime versions, asset preparation/disposal, authoring controls, import coverage and remaining limits are documented in [the current feature contract](../../docs/30-advanced-2d-authoring.md).

Native centered solid strokes now retain their centerlines through source/runtime validation, Canvas rendering, supported animation and `.riv` export/import. Studio provides a stroke bottom sheet and constant-width Freehand mode. See [native stroke contracts, workflow and limits](../../docs/41-native-strokes-and-path-effects.md); gradient/skinned strokes and full Editor-file import remain outside this increment.
