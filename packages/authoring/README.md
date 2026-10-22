# @evir/authoring

Pure editing operations used by Studio: undo/redo `History`, node creation/reparent/order/deletion, path topology, bone binding and weight assignment, keyed properties, and animation/machine creation. This package owns editable operations, while playback belongs to `@evir/runtime`. It has no DOM or persistence UI. See [the package guide](https://github.com/Mgregchi/Evir/blob/main/packages/README.md).

History shares unchanged immutable records internally. `snapshot()` and `committed()` return detached copies. Read-only tools can use `readCommitted()` to share the deeply frozen committed version without copying embedded resources; create an immutable candidate or use a history transaction for changes. `revision` changes on committed edits/undo/redo. Reparenting offsets animated X/Y keys between matching static parent bases and rejects changes requiring general animation rebasing; see [workflow contracts](../../docs/31-studio-workflow-and-recovery.md).

## Shape presets

Shape presets are available through `SHAPES`, `shapeGeometry` and `addShape`. By default they create ordinary editable rectangle/path geometry with atomic validation. Opt in to persistent preset controls with `{parametric:true}` as described below. See [shape and beginner contracts](../../docs/46-shapes-and-first-animation.md) for dimensions, parameter bounds, parent/lock rules and the public first-animation lesson.

## Joining paths

`planPathJoin(project, keepId, otherId, {keepEnd:'last',otherEnd:'first',mode:'bridge'})` validates and previews a pure candidate. `joinPaths` applies that validated plan atomically and returns the kept ID. Merge retains the kept endpoint and removes the chosen donor endpoint; Bridge adds a straight connector. Both require compatible adjacent open unskinned siblings and reject unsafe references, paint, transforms and point budgets. See [the workflow and exact bounds](../../docs/44-path-joining-and-outing.md).

`bindSkin(project, nodeId, boneIds)` binds an existing path or mesh to one to four different same-artboard bones; rebinding resets weights to equal shares. `setSkinWeights(project, nodeId, changes)` atomically assigns normalized per-control influences, including previously zero/omitted bound bones. Mesh edits use anchor and synchronize all three source slots. Locked/hidden ancestry rejects edits. Existing bindPath/setWeight share these operations. See [graphical weights, bounds and Gust](../../docs/43-graphical-skin-weights.md).

Live presets: `addShape(p,preset,{parametric:true,...options})` retains canonical shape controls in editable source. `setShapeParameters` changes them; `detachShape` enables free control-point editing. Compound helpers and the optional curve Boolean entry are documented in [compound paths](../../docs/48-compound-paths-and-boolean-curves.md). Path joining also accepts `mode:'smooth'` for a reflected-handle connector. [The live-shape guide](../../docs/49-live-shape-controls.md) covers source/runtime isolation, controls, limits and typed local commands.

`setSkinLocks` freezes specific bone influences on anchors/handles; `autoSkinWeights` assigns by bind-segment distance and `smoothSkinWeights` averages contour/triangle neighbors. Both preserve frozen byte weights, accept bounded subsets, and support immutable preview candidates. `unbindSkin` clears the binding and its editor locks. See [weight tools and limits](../../docs/52-automatic-weights-and-influence-locks.md).
