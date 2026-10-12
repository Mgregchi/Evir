# @evir/authoring

Pure editing operations used by Studio: undo/redo `History`, node creation/reparent/order/deletion, path topology, bone binding and weight assignment, keyed properties, and animation/machine creation. This package owns editable operations, while playback belongs to `@evir/runtime`. It has no DOM or persistence UI. See [the package guide](https://github.com/Mgregchi/Evir/blob/main/packages/README.md).

History shares unchanged immutable records internally while returning detached snapshots. `revision` changes on committed edits/undo/redo. Reparenting offsets animated X/Y keys between matching static parent bases and rejects changes requiring general animation rebasing; see [workflow contracts](../../docs/31-studio-workflow-and-recovery.md).
