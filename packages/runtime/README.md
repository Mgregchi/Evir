# @evir/runtime

The reusable Evir playback engine for the existing scene subset. `createRuntime` accepts a validated in-memory scene; `loadRuntime` parses/verifies JSON asynchronously. A player exposes `advance(seconds)`, `setInput(nameOrId, value)`, `click(targetId)`, `reset()`, `pose()`, `snapshot()`, `artboard` and `state`. Animation and skinning utilities have explicit subpath exports. The package runs without DOM/editor UI or an official Rive dependency. See [contracts, limitations and release steps](https://github.com/Mgregchi/Evir/blob/main/packages/README.md).

Advanced 2D contracts, source/runtime versions, asset preparation/disposal, authoring controls, import coverage and remaining limits are documented in [the current feature contract](../../docs/30-advanced-2d-authoring.md).

Playback modes/counts/speed, independent timeline layers, the Sunday motorcycle and native export policy are documented in [playback and motorcycle contracts](../../docs/32-animation-playback-and-motorcycle.md).

Native centered solid strokes now retain their centerlines through source/runtime validation, Canvas rendering, supported animation and `.riv` export/import. Studio provides a stroke bottom sheet and constant-width Freehand mode. See [native stroke contracts, workflow and limits](../../docs/41-native-strokes-and-path-effects.md); gradient/skinned strokes and full Editor-file import remain outside this increment.

Ordered direct states retain keyed property values between explicit advance calls, while pose reads are idempotent and forks/reset remain independent. See [direct blend contracts and Lumen](../../docs/45-direct-blends-and-lumen.md).
