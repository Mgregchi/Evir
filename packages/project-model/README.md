# @evir/project-model

Owns strict editable-project and runtime-snapshot validation, verified JSON persistence, identifiers and scene transforms. `createProject`, `validateProject`, `openProject` and `serializeProject` retain the current editable v1/v2 contract. `toRuntimeProject`, `validateRuntimeProject` and `openRuntimeProject` provide playback data without editor state. See [package usage and release boundaries](https://github.com/Mgregchi/Evir/blob/main/packages/README.md).
