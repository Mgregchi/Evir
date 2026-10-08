# Editor experience research and prototype decisions

Evir's editor must make building and animating an interactive character understandable, predictable and pleasant. The user explicitly prioritized a clean interface and good user experience on 2026-10-08. This pass studies public primary documentation and visual references before implementing the first workspace. It does not claim that aesthetic similarity guarantees usability.

## Platforms and evidence

| Platform       | Material reviewed                                                                                                                | Useful patterns for Evir                                                                                                                         | Evidence limits                                                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Rive           | Pinned editor docs: stage, hierarchy, navigation, inspector, Design/Animate modes, timeline and keys; published stage screenshot | Central stage, parent-aware selection, contextual properties, distinct design/key editing, key-state feedback, filtered animation tracks         | Public workflow documentation and screenshots; no access to the closed editor implementation or authenticated usability session |
| Penpot         | Official interface tour and its annotated workspace screenshot                                                                   | Discoverable layer search, contextual design properties, grouped creation tools, visible file status, separate design/prototype/inspect contexts | Documentation, not measured task performance                                                                                    |
| SVGator        | Official “Parts of the SVGator app interface” guide                                                                              | Separate element and property panels, searchable layers, visible undo/redo, explicit save/export, timeline zoom/playhead/easing controls         | Documentation; controls were not exercised in a logged-in editor                                                                |
| Lottie Creator | Official product page and published editor visual                                                                                | Outliner/inspector/stage arrangement, separate animation and state-machine contexts, graph-based easing, nested scenes                           | Marketing claims and visual reference, not independently verified feature behavior or rendering fidelity                        |

[Fetch provenance](../research/editor-ux/sources.json) records the successfully fetched URLs and content hashes. The Figma guide request returned a proxy 403; it supplies no verified observations in this comparison. The initially guessed SVGator URL returned 404; navigation through its help index located the actual interface guide. Third-party visual references were inspected for research, not copied into Evir's interface assets.

## Shared structure, different editing jobs

The recurring structure is useful because it keeps three linked questions close: “Which object am I editing?” in the hierarchy, “What does it look like?” on the stage, and “What can I change?” in the inspector. Rive adds timeline and state-machine workflows because interactive animation involves authored values, animated poses and live state. Those editing jobs need an explicit context; presenting every property and graph simultaneously would increase clutter and accidental edits.

Evir should keep a stable stage and selection across Design, Animate and Interact contexts when those features exist. Animate should show the active timeline, playhead, key state and whether an edit writes a key. Interact should show the machine graph, target, condition/action inspector and a resettable test-input panel. Moving between contexts must not mutate design defaults or restart unrelated document edits. The first prototype supports Design only, so it shows Design as a status rather than offering empty animation tabs.

For character work, rigging needs its own contextual tools: select a bone chain, bind control points, show influences, edit normalized weights and test a pose. Rive's documentation distinguishes vertex and Bézier-handle influences. Evir should preserve that distinction while progressively revealing the controls after a rig is selected. Rigging interactions and their usability remain a subsequent milestone; the first prototype does not imply their implementation.

## Decisions implemented in the first workspace

| Decision                                                         | Purpose                                                                          | Implementation / check                                                                                                    |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Quiet dark chrome and a light artboard                           | Keep the work visually central with a restrained mint selection accent           | CSS tokens; visually reviewed desktop and laptop screenshots                                                              |
| Consistent left Layers / center stage / right Properties         | Link structure, artwork and editable values                                      | Selection updates both layer highlight and contextual inspector                                                           |
| A small original sample character plus a real empty state        | Give people something immediately editable; explain how to start a blank project | Grouped rectangle character; New creates a blank artboard with an Add action                                              |
| Searchable, named layers                                         | Make nested parts findable without precision stage clicking                      | Search test finds Body; sidebar selection addresses the exact nested object                                               |
| Select groups by default; modifier-click to select a child       | Let character parts move together while allowing precise edits                   | Group selection and drag; Ctrl/Command deep selection                                                                     |
| Labeled actions and discoverable shortcuts                       | Avoid requiring prior knowledge of icon meanings                                 | Visible Select/Pan/Rectangle/Group/Undo/Redo; shortcut dialog; accessible labels                                          |
| One drag, one undo step; Escape cancels                          | Make experimentation reversible                                                  | Model and browser tests verify preview isolation, cancellation and undo grouping                                          |
| Save a project separately from runtime export                    | Prevent confusing editable source with a deployed animation                      | Save downloads a versioned `.evir-project.json`; no unimplemented runtime-export control                                  |
| Explicit local save state and recovery                           | Make persistence understandable without implying cloud storage                   | “Saved in this browser”; validated reload recovery; storage failures surface a download recommendation                    |
| Reject unsupported or corrupt imports without replacing the work | Prevent silent loss and give actionable diagnostics                              | Version, unknown field, reference, geometry and asset-hash checks; browser test confirms current project survives failure |
| Keep global shortcuts out of text fields                         | Let names and values be edited safely                                            | Browser acceptance checks shortcut isolation                                                                              |
| Fit and cursor-centered zoom, temporary Space-pan                | Help people navigate without losing their artwork                                | Fit action, zoom readout, mouse/keyboard controls                                                                         |

The prototype uses independently authored HTML/CSS/JavaScript and existing browser test dependencies. It does not adopt a third-party editor framework or proprietary interface assets. UI labels say what the creator can do, while schema and research details remain in diagnostics and documentation.

## Quality criteria before expanding the workspace

Functional automation catches broken interactions; it cannot establish that users find them clear. The recorded [browser acceptance checks](../research/results/editor-prototype/acceptance.json) and screenshots cover two desktop/laptop viewports. They are not representative user testing, assistive-technology validation, physical touchscreen validation or a benchmark of large projects.

For a moderated first study, recruit both people familiar with Rive and people new to character animation. Ask them to perform these tasks without coaching:

1. Find and recolor the sample character's body, then undo the change.
2. Move the whole character; select a nested part without moving the group.
3. Create a new shape, rename it, change its parent and keep its visual position.
4. Lock/hide a layer, find it again, and recover the full artwork using Fit.
5. Save a project, reopen it, reload the browser, and explain where their work is stored.

Record task completion, time, navigation errors, accidental edits, help requests and the participant's explanation of selection/save state. Establish a baseline before setting numerical usability targets; do not invent results from automated tests. Treat unrecoverable work loss, silent import loss, accidental base-pose mutation and unclear save state as release blockers. Collect which labels and gestures participants actually misunderstand, then revise the interaction instead of adding decorative polish.

For later animation/interaction milestones, repeat the study with setting a key, retiming motion, returning to the design pose, creating an input-triggered transition, testing a listener and resetting preview. Performance evaluation should include hierarchy search, selection and scrub latency on the supplied SOBO-scale workload once semantic import exists.

## Remaining work

This prototype establishes project persistence, transaction history and a Design workspace for groups and rectangles. The subsequent path, rigging, animation/state-machine and `.riv` export milestones are now implemented for the [declared tested subset](13-editor-milestone-acceptance.md). Before claiming a polished usable editor, add resizable/collapsible panels, hierarchical expand/collapse, multiselection and marquee, snapping and guides, drag-and-drop layer organization, resize handles, keyboard navigation of the scene tree, and representative user testing. Desktop widths below 850 pixels currently use horizontal overflow rather than a mobile editing experience.

## Primary references

- [Rive navigation](https://github.com/rive-app/rive-docs/blob/8879acbbefbf676c8d68d66c2ddfe56c6ee50914/editor/interface-overview/selection-and-navigation.mdx), [inspector](https://github.com/rive-app/rive-docs/blob/8879acbbefbf676c8d68d66c2ddfe56c6ee50914/editor/interface-overview/inspector.mdx), [stage](https://github.com/rive-app/rive-docs/blob/8879acbbefbf676c8d68d66c2ddfe56c6ee50914/editor/interface-overview/stage.mdx), [timeline](https://github.com/rive-app/rive-docs/blob/8879acbbefbf676c8d68d66c2ddfe56c6ee50914/editor/animate-mode/timeline.mdx), and [key feedback](https://github.com/rive-app/rive-docs/blob/8879acbbefbf676c8d68d66c2ddfe56c6ee50914/editor/animate-mode/keys.mdx)
- [Penpot interface tour](https://help.penpot.app/user-guide/first-steps/the-interface/)
- [SVGator interface guide](https://www.svgator.com/help/getting-started/parts-of-the-svgator-app-interface)
- [Lottie Creator](https://lottiefiles.com/lottie-creator)
