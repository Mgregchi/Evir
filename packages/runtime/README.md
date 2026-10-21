# @evir/runtime

The reusable Evir playback engine for the existing scene subset. `createRuntime` accepts a validated in-memory scene; `loadRuntime` parses/verifies JSON asynchronously. A player exposes `advance(seconds)`, `setInput(nameOrId, value)`, `click(targetId)`, `reset()`, `pose()`, `snapshot()`, `artboard` and `state`. Animation and skinning utilities have explicit subpath exports. The package runs without DOM/editor UI or an official Rive dependency. See [contracts, limitations and release steps](https://github.com/Mgregchi/Evir/blob/main/packages/README.md).

Advanced 2D contracts, source/runtime versions, asset preparation/disposal, authoring controls, import coverage and remaining limits are documented in [the current feature contract](../../docs/30-advanced-2d-authoring.md).

Playback modes/counts/speed, independent timeline layers, the Sunday motorcycle and native export policy are documented in [playback and motorcycle contracts](../../docs/32-animation-playback-and-motorcycle.md).

Compound paths, gradient/skinned centerline strokes and one-to-eight-bone unit-scale IK extend the supported playback subset. See [the current contracts and native comparisons](../../docs/47-software-closure.md). Automatic weights and influence locks are authoring operations; editor locks stay out of runtime snapshots. Full Editor-file import remains outside the declared subset.

Ordered direct states retain keyed property values between explicit advance calls, while pose reads are idempotent and forks/reset remain independent. See [direct blend contracts and Lumen](../../docs/45-direct-blends-and-lumen.md).
