# @evir/project-model

Owns strict editable-project and runtime-snapshot validation, verified JSON persistence, identifiers and scene transforms. `createProject`, `validateProject`, `openProject` and `serializeProject` retain the current editable v1/v2 contract. `toRuntimeProject`, `validateRuntimeProject` and `openRuntimeProject` provide playback data without editor state. See [package usage and release boundaries](https://github.com/Mgregchi/Evir/blob/main/packages/README.md).

The early source v2/runtime v1 vocabulary now allows a solid hex string or static `linear`/`radial` object in `geometry.fill`: two distinct local endpoints and 2–16 strictly increasing stops with hex RGBA colors. Skinned gradient paths and color-key tracks on gradient fills reject explicitly. Source v1 remains solid-only. Earlier readers reject this extension; no silent conversion or new binary format is implied. See [the contract and acceptance](../../docs/28-studio-gradient-paints.md).

Advanced 2D contracts, source/runtime versions, asset preparation/disposal, authoring controls, import coverage and remaining limits are documented in [the current feature contract](../../docs/30-advanced-2d-authoring.md).

Playback modes/counts/speed, independent timeline layers, the Sunday motorcycle and native export policy are documented in [playback and motorcycle contracts](../../docs/32-animation-playback-and-motorcycle.md).
