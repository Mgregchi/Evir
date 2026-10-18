# @evir/authoring

Pure editing operations used by Studio: undo/redo `History`, node creation/reparent/order/deletion, path topology, bone binding and weight assignment, keyed properties, and animation/machine creation. This package owns editable operations, while playback belongs to `@evir/runtime`. It has no DOM or persistence UI. See [the package guide](https://github.com/Mgregchi/Evir/blob/main/packages/README.md).

History shares unchanged immutable records internally while returning detached snapshots. `revision` changes on committed edits/undo/redo. Reparenting offsets animated X/Y keys between matching static parent bases and rejects changes requiring general animation rebasing; see [workflow contracts](../../docs/31-studio-workflow-and-recovery.md).

`bindSkin(project, nodeId, boneIds)` binds an existing filled path or mesh to one to four different same-artboard bones; rebinding resets weights to equal shares. `setSkinWeights(project, nodeId, changes)` atomically assigns normalized per-control influences, including previously zero/omitted bound bones. Mesh edits use anchor and synchronize all three source slots. Locked/hidden ancestry rejects edits. Existing bindPath/setWeight share these operations. See [graphical weights, bounds and Gust](../../docs/43-graphical-skin-weights.md).
