# Remaining software closure

20 October 2026. The user authorized continuing all remaining software work. Physical-device testing and hosted backend services remain deferred. The initial implementation starts from merged PR 40 (`c102907`). Primary-source retrieval outcomes and hashes are in [the source ledger](../research/software-closure/sources.json); unavailable pages provide no feature evidence.

This pass follows each change through the shared model, authoring, runtime/renderer, Studio, editable import/native export and local command interfaces where relevant. Existing source/export behavior, original brand artwork, the single web host and configured links remain requirements. Each feature needs original examples and appropriate tests; human usability, screen-reader sessions and matched Editor exports need their actual evidence.

| Work area | Current work and acceptance |
| --- | --- |
| Compound/Boolean paths | Implemented: shared contours and winding rules, curve-preserving optional Paper 0.14 kernel, cancellable Studio worker, contour editing, source/native round trips and original art. 56 official Canvas/WebGL2 comparisons and four responsive workflows passed before the subsequent live-shape expansion. Full integration checks are running. |
| Drawing and live shapes | Persistent preset controls implemented; see [live shapes](49-live-shape-controls.md). Smooth endpoint connection/continuation implemented with reflected handles and unchanged old curve segments. Freehand gesture concatenation and gradient/skinned strokes remain. |
| Editable import | Compound contours join the existing static contour support. Animated geometry, rounding/flags, data/layout and text/assets need independent native fixtures and official-runtime comparisons. |
| Rigging/blending | Automatic weights, smoothing/locks, general IK, nested blends and weighted layers need explicit source/runtime/export contracts and controls. |
| Text/layout/assets | Multiline/rich text, external resources and reflow require resource ownership, deterministic layout and matching supported native behavior. |
| Rendering | Inner feather/offset behavior and existing approximation differences require source research and measured rendering comparisons. No full-renderer-parity claim follows from selected fixtures. |
| Scale/reliability | Paginate or virtualize remaining large control lists, extend animation rebasing and investigate the recorded intermittent browser-test timeout. |
| Local MCP | Shape creation/parameters, detachment, compound combine/release and explicit path joining now have typed commands. Extend remaining authoring operations while keeping revision/lock/atomic-undo rules and audience controls. Hosted pairing stays deferred. |
| Remaining evidence | Matched official Editor scenes, beginner sessions and screen-reader observations stay distinct from cloud automation. Physical tests stay postponed. |

Paper's documented Boolean operations preserve Bézier geometry and handle compound winding. Polygon clipping was also examined; its polygon output would require flattening curves. The optional Paper kernel is isolated from normal authoring imports and Studio startup, runs in a disposable worker for previews, and has a separate standalone entry. Its MIT license is distributed with that entry. The standalone's headless build excludes unused file/canvas integration; real Node and browser checks validate geometry rather than claiming Canvas support from that build configuration.
