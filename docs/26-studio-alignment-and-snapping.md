# Alignment and snapping

Research and implementation: 11 October 2026. This increment adds authoring alignment and temporary drag guides. It keeps the single web host and existing engine/export contract.

## Research before implementation

[Rive Align and Distribute](https://rive.app/docs/editor/fundamentals/align-and-distribute) places controls in the Inspector: one selected object aligns to its artboard; several align to each other. Rive additionally documents key-object alignment and distribution. Evir implements the six basic alignment actions here; those additional operations remain open.

[Rive Rulers & Guides](https://rive.app/docs/editor/design/rulers-and-guides) describes per-artboard ruler, row/column/grid and component guides, excluded from runtime exports, and an optional snapping toggle. Evir implements temporary guides between object/artboard edges and centers. Persistent guides, ruler editing and guide components are not included in this increment. The six-pixel threshold and Alt bypass are Evir product choices, not measured or inferred Rive behavior.

[Penpot's interface guide](https://help.penpot.app/user-guide/first-steps/the-interface/) supplies another primary reference for a central workspace with contextual side controls. The existing compact rail and Properties drawer remain the interaction structure. [WCAG 2.2 Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) calls for a single-pointer alternative to dragging, separately from keyboard support. Inspector alignment buttons, existing numeric position/move fields, and keyboard nudges provide alternatives for these positioning actions.

Retrieved responses, resolved URLs and SHA-256 hashes are recorded in [the source register](../research/studio-snapping/sources.json). Sources inform the design; responsive browser tasks check Evir's actual behavior.

## Using the tools

Open **Canvas view** beside Fit and enable **Snap to alignment**. The default is off, preserving existing exact manual positioning. The preference survives reload in `evir.studio.snapping.v1`; it is separate from project/editor metadata and is never exported. It is available in Design. Move a layer or a selection near a visible object's or artboard's left/center/right or top/middle/bottom. Each axis can snap independently within six CSS pixels, independent of zoom or device pixel ratio. Hold **Alt** during a pointer move to bypass snapping; touch users can turn the preference off.

Dashed guides appear only while a selection move is previewed. A polite status announces changes of alignment target. Release commits one undo step; cancellation, lost capture, blur, resize and a second touch clear the provisional edit and guides through the existing gesture cancellation path. Pen controls, animation keys, numeric moves and keyboard nudges retain their existing exact behavior.

In **Properties → Alignment**, use Left, Center, Right, Top, Middle or Bottom. One selected root aligns to the artboard. Multiple roots align to their combined bounding box, moving each root independently. Selected descendants move with their selected ancestor once. All moves use world coordinates and the inverse of each parent transform, preserving rotation/scale. Validate every member before a single History transaction; locks, hidden selections, singular parents, incompatible child bones and cross-artboard selections reject without partial mutation. Buttons retain focus after Inspector refresh. Animate and Interact disable these base-geometry actions.

Bounds use the renderer's existing axis-aligned geometry bounds. For curves these include control points; this is conservative control-envelope alignment, not exact extrema of a rendered Bézier curve. Strokes and future effects will require a richer visual-bounds contract.

Targets are captured and sorted once when a drag begins. Per-axis nearest candidates are found by binary search, avoiding rebuilding scene bounds each pointer event. Moving roots, their descendants, enclosing ancestors, hidden ancestry and other artboards are excluded; visible locked objects remain useful stationary references. This is an implementation bound, not a large-scene memory or frame-rate benchmark.

## An original study

[Gather's editable source](../apps/web/assets/examples/gather.evir-project), [compatible export](../apps/web/assets/examples/gather.riv) and real Canvas poster are registered in the public examples gallery. Three offset grouped cards use Evir's mint, peach and forest palette and original leaf/sun/hill artwork. Select card 1, card 2 and card 3 using **Multiple**, then use **Align left** in Properties. Undo restores the composition. Turn on snapping to experiment with independent edges and centers. Glow animates solid fills; its runtime export contains geometry and animation, not editor guides.

## Verification and remaining work

`npm run test:editor` includes geometry/history tests plus five responsive alignment tasks at 320, 390, 844 landscape, 1024 and 1440 pixels. They check guide appearance/removal, zoom-independent targeting, Alt bypass, cancellation, one-step alignment undo, tap/keyboard Inspector actions, focus retention, preference recovery, export-metadata isolation and automated accessibility. Existing authoring, Pen, workspace and multi-touch workflows remain regression gates.

`npm run test:web` includes Gather source/export round trips and official Canvas2D/WebGL2 comparisons of original and aligned compositions at representative Glow frames. `npm run validate:editor` retains the broader authoring export oracle. The new Gather task also checks that aligning all three groups gives the same left coordinate and downloads the exact compiler-produced bytes. Fresh evidence and the final check ledger are under [studio-snapping](../research/results/studio-snapping/). Browser captures establish cloud Chromium behavior; physical devices, real GPU/memory measurements, assistive-technology/user sessions and controlled matched Rive Editor scenes remain open.

The [current remaining-work table](25-studio-navigation-and-remaining-work.md#remaining-work--current-plan) now points to freehand research next. Persistent ruler/grid guides, distribution and key-object alignment remain later positioning improvements. No deployment or platform-parity claim is made.
