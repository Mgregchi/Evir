# Selection and product experience quality

Research and implementation: 10 October 2026. This increment continues the editor work while applying the user's mobile, memory, accessibility, sharing and recovery requirements. It keeps one hosted `apps/web` app, separate Studio/UI packages and independent engine packages. It introduces no deployment variables.

## Research before implementation

The existing [editor case studies](11-editor-ux-research.md) and [public-site research](16-public-site-research.md) informed the product direction: clear modes, progressive controls, examples with editable sources, and restrained claims about shipped functionality. New primary sources are recorded with retrieval times and readable-snapshot hashes in [sources.json](../research/results/experience-quality/sources.json).

| Source | Finding and application |
| --- | --- |
| [Rive selection/navigation](https://raw.githubusercontent.com/rive-app/rive-docs/8879acbbefbf676c8d68d66c2ddfe56c6ee50914/editor/interface-overview/selection-and-navigation.mdx) | Click/marquee selection, Shift toggling, deep selection, parent/child navigation, pan and fit. Evir retains F for artboard fit and adds Shift+F for selection fit. |
| [WCAG reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) | A spatial canvas can require two dimensions; surrounding controls must still reflow. Studio uses modal panels below 850px and is checked at 320px. |
| [WCAG target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | Aim for generous mobile controls; primary mobile buttons are 44px, panel controls 40px and stage buttons 32px. This is not certification of every editor control. |
| [WCAG status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Expose feedback programmatically without stealing focus. Use status/alert roles and separately focus invalid form fields. |
| [Modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | Label panels, contain focus, support Escape and restore origin focus. Styled HTML dialogs supply modal behavior. |
| [Reduced motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion) | Static living-loader alternative and initially paused previews. |
| [Page visibility](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API), [observer disconnect](https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver/disconnect) | Stop scheduling inactive previews and clean up observers, listeners and pending loads on permanent page departure. |
| [Open Graph](https://ogp.me/), [Google title guidance](https://developers.google.com/search/docs/appearance/title-link) | Server-render descriptive titles, canonical metadata and an absolute story-image URL. Metadata does not establish indexing or ranking. |

## Implemented scope

Design mode supports Shift-click toggles, full-enclosure marquee, Shift-marquee toggles, deep marquee with Ctrl/Command, select-all, collective movement and deletion. Movement converts a world-space delta through each selected root's parent inverse. Selecting an ancestor and its descendant moves that branch once. Locked members and singular parent transforms reject the operation before committing. One completed gesture is one undo entry; Escape cancels. Child bones remain attached to parent tips. Animate/Interact retain single selection.

The stage provides arrow nudges, Shift ten-unit nudges, parent/child navigation, selection fit and zoom shortcuts. Layers support Up/Down/Home/End with roving focus. Marquee encloses renderer bounds, which include Bézier control bounds; it does not test exact filled-pixel intersection. Multi-selection supports movement/deletion, not bulk scaling, rotation, key editing or rigging.

Small screens show a full-width stage with Layers and Properties available through labeled modal panels. Panels close with Escape or their close control, restore focus and return to desktop layout on widening. Controls retain explicit text labels. The stage is a named focusable region; its canvas remains a visual counterpart to the Layers/Properties controls. Touch pointer events are accepted, but pinch zoom and physical mobile authoring have not been certified.

The private `@evir/ui` package shares a breathing/blinking seed loader and custom feedback with web and Studio. It contains no engine, service or hosting configuration. Reduced motion removes the character animation. Success toasts expire after eight seconds, pausing while hovered/focused/hidden; errors persist until dismissed or replaced. Feedback forms use inline errors, aria-invalid/describedby and first-invalid-field focus, without native validation popovers. App feedback does not call alert/confirm/prompt. The platform file picker and unsaved-work navigation guard remain browser-owned.

Web previews retain an original poster if loading or rendering fails and offer retry. Studio offers a custom reload recovery state if startup fails. The branded 404 retains navigation to home, examples and feedback, and is served with HTTP 404 by the repository server. Existing host routing configuration remains authoritative in production.

## Resource and sharing behavior

Public previews schedule requestAnimationFrame only while playing, intersecting the viewport, visible and not page-suspended. Pausing cancels the queued callback. Resuming resets elapsed time, avoiding a large hidden-time jump. A draw failure stops scheduling and restores the poster. Permanent page departure aborts pending fetches, disconnects the observer, removes signal-bound listeners and drops renderer/player references. BFCache suspension preserves state and resumes on pageshow. Native browser cache behavior needs separate device verification.

Preview canvases are fixed 512×512 buffers. Studio caps backing-store device pixel ratio at 2 and reuses its hit-test context. History already retains at most 100 snapshots. These are bounds and lifecycle improvements, not measured heap savings: project-sized snapshots and per-frame scene evaluation still allocate. There is no new zero-allocation or GPU/mobile performance claim.

The 1200×630, 84,258-byte JPEG follows the original Milo character from Bézier outlines to motion to a hello. It is explicitly a generated illustration, not a fabricated editor screenshot; the supplied logo/icon were excluded from generation and remain unchanged. [Asset provenance](../apps/web/assets/README.md) records the hash. With existing SITE_URL configured, public pages render absolute Open Graph/Twitter image metadata, descriptions and canonical URLs. Studio and the error page use noindex; robots excludes the workspace and the sitemap contains public pages. Local builds without SITE_URL do not invent a canonical hostname.

## Validation and remaining gates

Reproduce with:

```sh
npm ci
npm run test:frontend
npm run test:runtime
npm test
npm run test:editor
npm run test:web
npm run test:experience
npm run validate:editor
```

[Selection evidence](../research/results/experience-quality/selection.json) covers Shift toggle, marquee, collective drag/undo, nudge/undo, Layers keyboard focus and responsive panels at 320/390/768/1100/1440px. Checks assert no page-level horizontal overflow, a usable stage and zero automated WCAG 2/2.1 A/AA violations at those widths. [Web evidence](../research/results/experience-quality/web.json) covers failed-load retry, reduced-motion defaults, zero inactive frame callbacks, simulated visibility/BFCache suspension, custom form errors/dismissal, prefixed sharing metadata, JPEG serving, 404 and failed-module recovery. Simulation is not native BFCache certification. Existing public-site checks cover all 11 pages in root/prefixed builds and official runtimes cover example exports.

[Final validation record](../research/results/experience-quality/validation.json): local validation passed 25 editor unit checks, 8 frontend checks, 6 runtime contract checks and 22 Python checks, plus the editor/site browser workflows. Official Canvas2D and WebGL2 comparisons cover 40 authoring cases, 30 showcase cases and two Pen exports.

The first full run exposed a timing flaw in the existing click-listener oracle: pinned Rive 2.44.0 drawFrame advances from the document clock and can reschedule a playing machine, so screenshot capture observed a later pose than the requested frame zero. The oracle now resets its render-clock reference before that explicit zero-time draw and stops scheduling afterward. The listener still receives a real browser mouse click; comparison tolerances and engine/export behavior are unchanged.

Automated accessibility is not equivalent to a screen-reader study. Physical touch, mobile heap/GPU measurements, representative user sessions, production crawler/link-card rendering and controlled equivalent Rive Editor exports remain open. The user deferred the physical-device audit. Research snapping/guides, freehand and richer authoring next; agent/provider choices and new format decisions remain separate research gates.

## Subsequent visual review

The user reported that the first mobile reflow remained cluttered despite its passing overflow and automated accessibility checks. The [workspace UX revision](24-studio-workspace-ux.md) supersedes that layout with a compact header, persistent rail and contextual drawers, and adds screen-area and editing-task evidence. The earlier checks establish functionality, not usability certification.
