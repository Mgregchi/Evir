# @evir/runtime

The reusable Evir playback engine for the existing scene subset. `createRuntime` accepts a validated in-memory scene; `loadRuntime` parses/verifies JSON asynchronously. A player exposes `advance(seconds)`, `setInput(nameOrId, value)`, `click(targetId)`, `reset()`, `pose()`, `snapshot()`, `artboard` and `state`. Animation and skinning utilities have explicit subpath exports. The package runs without DOM/editor UI or an official Rive dependency. See [contracts, limitations and release steps](https://github.com/Mgregchi/Evir/blob/main/packages/README.md).
