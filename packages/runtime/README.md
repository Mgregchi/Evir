# @evir/runtime

The reusable Evir playback engine for the existing scene subset. `createRuntime` accepts a validated in-memory scene; `loadRuntime` parses/verifies JSON asynchronously. A player exposes `advance(seconds)`, `setInput(nameOrId, value)`, `click(targetId)`, `reset()`, `pose()`, `snapshot()`, `artboard` and `state`. Animation and skinning utilities have explicit subpath exports. The package runs without DOM/editor UI or an official Rive dependency. See [contracts, limitations and release steps](https://github.com/Mgregchi/Evir/blob/main/packages/README.md).

Advanced 2D contracts, source/runtime versions, asset preparation/disposal, authoring controls, import coverage and remaining limits are documented in [the current feature contract](../../docs/30-advanced-2d-authoring.md).

Playback modes/counts/speed, independent timeline layers, the Sunday motorcycle and native export policy are documented in [playback and motorcycle contracts](../../docs/32-animation-playback-and-motorcycle.md).
