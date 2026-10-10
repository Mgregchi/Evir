# Pen authoring: research, decisions and acceptance

Rive's creation and vertex guides were reviewed before implementation on 10 October 2026; Penpot's path guide was cross-checked during this pass. This is the next bounded editor step after the four [authoring milestones](13-editor-milestone-acceptance.md), following the recorded drawing/selection gaps. It runs inside `@evir/studio`, composed at `/editor/studio/` by the single web app. The engine APIs, schema and hosting settings are unchanged.

## Research findings

| Primary evidence | Finding | Evir decision |
| --- | --- | --- |
| Rive Pen guide [R1] | P activates Pen; clicks create vertices, drags create Bézier handles. | Use the documented creation gestures and a labeled Pen button. |
| Rive Edit Vertices [R2] | Drag-created handles are mirrored; detached handles can be edited independently; paths can be open. | Mirror handles during creation, then retain the existing detached-control representation and inspector. No persistent mirrored constraint is claimed. |
| Penpot Objects / Paths [P1] | Corner clicks and curved-node drags; first-node click closes, Enter or Escape leaves a path open. Freehand is a separate tool. | First-anchor click closes; Enter finishes open. Keep freehand out of this step. |
| Existing Evir model/history/export checks | Open paths need two points, closed paths need three; parent transforms are affine; incomplete documents must not enter committed history. | Keep a transient draft and commit the complete path in one transaction. Store points in the selected parent's local coordinates. |

Evir deliberately uses **Escape to cancel the draft**, consistent with its existing reversible-drag behavior; Rive and Penpot document Escape as finishing a path. Visible Finish/Cancel buttons and stage instructions explain Evir's choice. Other competitor shortcuts, path extension and advanced node constraints are not inferred from this small implementation.

Sources were retrieved successfully from immutable official repository revisions; [the register](../research/editor-pen/sources.json) records URLs and content hashes. The Penpot help-site request returned 403, so the official documentation repository supplied the path guide. The user's live web URL also returned 403 from this workspace; Chromium reported a certificate trust error. Production behavior was not verified by disabling TLS checks.

## Implemented contract

Pen works in Design. A click creates a straight anchor; a drag longer than three screen pixels creates mirrored in/out handles. The stage shows draft anchors, handles and the prospective next segment. First-anchor closing uses an eight-screen-pixel hit radius after three points, without duplicating the first anchor. Finish accepts two or more points as an open path; fewer points or an unreleased pointer produce a diagnostic. Paths retain the existing solid-fill semantics: open paths have no new stroke, and a straight two-point path has no filled area.

A selected visible/unlocked group or bone is the parent; other selections create a root path. The inverse parent world matrix maps drawing coordinates into local controls, preserving the displayed geometry under rotation and scale. A singular parent is rejected before changing the project. Handles become independently editable through the existing inspector after finishing.

The draft stays outside the saved project and history until Finish/close creates one undo entry. Escape/Cancel discards it. Backspace removes the last draft point; an interrupted pointer gesture removes only its pending point. Undo during drawing cancels the draft without undoing older work. Temporary Space-pan and normal viewport navigation remain available between point gestures. Tool/mode changes, property edits, saving and runtime export require finishing/cancelling first. New/Open retain the explicit project-replacement flow; reload warns about the unsaved draft. Only committed paths recover from browser storage.

## Acceptance evidence

`npm run test:editor` includes two drawing model tests and a real browser workflow through the composed web route. Checks cover affine parent coordinates and mirrored handles, valid minimum topology, interrupted gestures, close/open/Enter/Finish/Cancel/Backspace, draft isolation, one-step undo/redo, input shortcut isolation, Design-only availability, independent inspector editing, save/open/browser recovery, temporary pan, and desktop/laptop layouts. [Screenshots](../research/results/editor-pen/drawn-path.png) and [the laptop draft](../research/results/editor-pen/draft-laptop.png) were visually reviewed.

The browser downloads `.riv` from actual Pen-authored closed and open curves under a rotated/nonuniformly scaled group. Official Canvas2D and WebGL2 2.44.0 render that exact download at 256×256; every RGBA channel and covered-pixel count are compared with Evir's existing Canvas renderer. Both pass the existing bounds (mean absolute channel error below 2.5/255; coverage difference below 350 pixels). [Recorded results](../research/results/editor-pen/acceptance.json) show error below 0.10/255 and coverage difference below 40 pixels. This tests the new creation workflow against the established export subset, not general renderer parity or performance.

The cloud uses software graphics. Physical-device measurements remain deferred, equivalent Rive Editor scene comparisons remain pending, and automated workflows/screenshots do not establish representative usability. Next is research and implementation of multiple selection/marquee and navigation; freehand, snapping, gradients/clipping/feathering, richer deformation/blending and AI/agent contracts remain in the broader research plan.

[R1]: https://github.com/rive-app/rive-docs/blob/8879acbbefbf676c8d68d66c2ddfe56c6ee50914/editor/fundamentals/pen-tool-overview.mdx
[R2]: https://github.com/rive-app/rive-docs/blob/8879acbbefbf676c8d68d66c2ddfe56c6ee50914/editor/fundamentals/edit-vertices.mdx
[P1]: https://github.com/penpot/penpot-docs/blob/dae434432ed4a523ea1013666aa23451dbd12eb8/user-guide/objects/index.njk
