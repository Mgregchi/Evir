# Studio workspace revision

The user's mobile screenshots showed a real UX gap: the previous reflow checks prevented page overflow but left several control rows competing with the artwork. The project header, file actions, tools, panel switcher and view controls had accumulated vertically. Passing axe or fitting within the viewport did not establish a clean editing experience.

## Research before implementation

Live material was fetched on 10 October 2026. [Source provenance](../research/studio-workspace/sources.json) records URLs, response sizes and SHA-256 hashes. Google returned a redirect shell rather than readable results. Bing returned results including Rive's official documentation and editor alongside unrelated streaming products; only the official editing sources were used. Search ranking supplied discovery, not evidence of editor behavior.

- [Rive's current interface overview](https://rive.app/docs/editor/interface-overview/overview) describes a toolbar, sidebar, contextual inspector and central viewport, and explicitly emphasizes showing what is needed when it is needed. The user's authenticated screenshots additionally show compact file controls and sidebar navigation. They do not establish touch usability or expose the editor implementation.
- [Penpot's interface guide](https://help.penpot.app/user-guide/first-steps/the-interface/) describes grouped shape/free-draw flyouts, workspace visibility controls and selection-dependent properties. This supports grouping less frequent creation commands and making panels independently collapsible.
- [SVGator's interface guide](https://www.svgator.com/help/getting-started/parts-of-the-svgator-app-interface) separates stage, element/property panels and timeline and lists fit/zoom controls. Preserve distinct editing contexts rather than stacking every control on the canvas.
- [WAI disclosure guidance](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) informs expanded states and keyboard activation. The project/Create/view flyouts use native, custom-styled HTML popovers and ordinary buttons, without pretending to implement an ARIA application menu.
- [WAI modal-dialog guidance](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) informs drawer labeling, visible Close, Escape dismissal, contained focus and restoration to the invoking rail button.
- [WCAG target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) specifies a 24 CSS pixel minimum with exceptions. Evir's main rail buttons use at least 40 × 40 pixels; portrait touch controls use 44-pixel heights. This is a design decision, not a claim that every editing gesture is accessible.

The [earlier case studies](11-editor-ux-research.md) and [experience-quality work](22-selection-and-experience-quality.md) remain useful but their mobile layout assessment is superseded by this revision. Rive's accounts, asset marketplace, scripting and Agent sections are research context, not shipped Evir features. No third-party interface assets or Rive gallery artwork were copied.

## Implemented interaction

The single hosted `apps/web` still imports the independent Studio package at `/editor/studio/`. This change adds no hosting targets or environment variables and changes no engine package contract.

The 64-pixel project header contains the supplied wordmark, editable project title/local save status, a persistent right-aligned Save button and Project menu. New/Open/Export live together in that menu with a short distinction between editable source and runtime output. Save downloads an editable copy; browser recovery remains local rather than implying cloud sync.

A narrow persistent left rail contains labeled Select/Pan/Pen tools, Create, Layers, Properties, Undo/Redo and Help. Create groups Rectangle/Group/Path/Bone. Design/Animate/Interact remain visible in a compact context strip. The canvas has one compact artboard/Fit/zoom row. Less frequent view actions live in the zoom flyout. No essential mode requires horizontal toolbar scrolling.

Desktop Layers and Properties collapse independently. At 850 pixels and below, the same panel DOM moves into a side drawer; project state and pending field values are retained. The Timeline/Machine rail entry appears in its corresponding mode and opens animation/interaction controls in a drawer, allowing the stage to keep its height even in landscape. The visible Close control and Escape restore focus to the invoking rail button. Keyboard field editing does not trigger canvas shortcuts. Feedback moves into an active modal drawer so custom errors remain visible in the browser's top layer.

New fitted views remain centered as layout dimensions change. Manually panned/zoomed views preserve their world-space center when resizing. Browser recovery retains an already visible saved camera; a saved artboard that no longer fits the new viewport is refitted. Fit uses smaller margins on narrow/short stages. Canvas pixel allocation remains capped at DPR 2 and the existing reused hit-test context is retained.

Startup renders the original wordmark beside the independent living seed illustration, with actual project-restoration/tool-preparation messages. It adds no fake progress percentage or artificial delay. The shell is inert during preparation. Reduced motion keeps the illustration static. Module failure replaces preparation with branded Reload/Return-home recovery, preserving local storage. With JavaScript disabled, a direct Return-home link remains usable while editing controls are inert. Studio playback cancels scheduled animation callbacks while hidden or suspended and resumes without accumulating hidden time.

Existing public-page sharing metadata still points to the original 1200 × 630 story banner. The branded 404 page, preview retry, inline feedback validation and custom toasts remain part of this increment's regression checks. No browser `alert`, `confirm` or `prompt` was introduced. Browser-owned file selection and the unsaved-page navigation guard remain platform behavior.

## Acceptance and limits

Run `npm run test:editor`, `npm run test:experience` and `npm run test:web`. The [workspace browser test](../tests/editor/workspace-browser.cjs) exercises six sizes: 320 × 568, 390 × 844, 768 × 1024, 844 × 390, 1024 × 768 and 1440 × 1000. It checks header placement, visible rail targets, stage area, fitted centering, bounded pixel buffers, keyboard disclosures, desktop panel collapse, mobile Layers → Properties edit/undo, timeline/machine access and source/runtime downloads. It also delays module delivery to inspect actual first-paint loading, aborts it to inspect recovery, and counts callbacks during simulated visibility/page-lifecycle suspension.

[Recorded measurements and screenshots](../research/results/studio-workspace/acceptance.json) provide evidence for the layout and tasks. Automated WCAG checks cover the workspace, Layers drawer and timeline drawer. This is browser automation and visual review, not moderated user testing, screen-reader certification, real mobile heap/GPU measurements or native BFCache certification. Physical device testing remains deferred as requested. The subsequent [navigation and organization increment](25-studio-navigation-and-remaining-work.md) adds two-finger navigation, independently resizable desktop panels and hierarchical/bulk layer organization. Representative usability sessions remain open.

All listed local checks passed for this revision: 25 editor unit tests and five browser workflows, 12 frontend tests, six runtime tests, 22 public page/configuration checks, five unchanged gallery source/export round trips, 40 authoring and 84 showcase comparisons against official Rive backends, plus two Pen comparisons. See the [validation ledger](../research/results/studio-workspace/validation.json) and the adjacent raw oracle reports. The website’s four real Studio screenshots were refreshed to match this workspace.
