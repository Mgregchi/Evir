# @evir/format

Explicit compatibility adapter: `compileProject(project, schema = runtimeSchema)` emits the currently tested `.riv` subset and source-ID mapping. The pinned schema is embedded by app/package builds, so editor export requires no research-server request. It is independent of the renderer/editor UI. The upstream schema's license is retained in `schema/LICENSE.rive` and the standalone distribution. The structural Python reader/writer remains a research tool at `tools/riv.py`; `importRiv` reconstructs the declared editable subset; general Editor-file conversion remains open. See [package boundaries and release instructions](https://github.com/Mgregchi/Evir/blob/main/packages/README.md).

Local linear/radial paints emit one gradient mutator per Fill with parent-linked GradientStop records. Supported endpoint/stop animation and skinned path paints follow the [current advanced contract](../../docs/30-advanced-2d-authoring.md).

Advanced 2D contracts, source/runtime versions, asset preparation/disposal, authoring controls, import coverage and remaining limits are documented in [the current feature contract](../../docs/30-advanced-2d-authoring.md).

Playback modes/counts/speed, independent timeline layers, the Sunday motorcycle and native export policy are documented in [playback and motorcycle contracts](../../docs/32-animation-playback-and-motorcycle.md).

Native centered solid strokes now retain their centerlines through source/runtime validation, Canvas rendering, supported animation and `.riv` export/import. Studio provides a stroke bottom sheet and constant-width Freehand mode. See [native stroke contracts, workflow and limits](../../docs/41-native-strokes-and-path-effects.md); gradient/skinned strokes and full Editor-file import remain outside this increment.

Static native contour import now converts mixed straight/mirrored/asymmetric/detached vertices, ellipses, rectangle origins and unskinned contour transforms into editable controls. Supported skin bindings and Shape/bone motion retain their existing contracts. Animated contour geometry, rounding, nondefault path flags and compound contours reject explicitly. See [contour import and Tide](../../docs/42-editable-riv-contours.md).

`tide-poster.png` is an actual Canvas capture of the original Pebble seal/shore study. `examples/tide-native.riv` is independently encoded from `../import-scene.mjs` using real native ellipse/rectangle/mixed-vertex records, not produced by the Rive Editor. The editable `tide.evir-project` is generated through `importRiv`; `tide.riv` is its Evir re-export. All artwork is original MIT project work; no supplied research/reference scene or altered brand art is included.
