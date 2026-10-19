# Shape creation and a first animation

19 October 2026. Studio’s quick-create menu previously offered only Rectangle/Group, and Learn asked beginners to import an example. This increment adds a visual shape palette and a blank-project animation lesson. The single web host, package boundaries, supplied branding and hosting variables remain unchanged.

## Research before implementation

[Live retrieval](../research/shape-library/sources.json) records URLs, outcomes, retrieval times and content hashes, including unsuccessful lookups. The [Inkscape shape tutorial](https://inkscape.org/doc/tutorials/shapes/tutorial-shapes.html) explains shape tools, numeric parameters and shape/path distinctions. [MDN drawing shapes](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Drawing_shapes) explains lines, closure and Bézier controls. These informed the palette and geometry; no external artwork is included.

[Rive’s keys documentation](https://rive.app/docs/editor/animate-mode/keys) describes recording properties from stage/Inspector edits and explicit key buttons. Evir’s actual authoring implementation and browser workflow determine this lesson’s labels and behavior. The fetched Rive manipulating-shapes overview concerns rigs/constraints; it supplies no primitive-tool UI evidence. Failed Rive/Penpot paths supply no feature evidence.

[WAI dialog guidance](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) informs heading focus, containment, Escape and focus return. [WCAG dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) informs numeric size/point/frame alternatives. Bottom sheets and reduced motion follow the user’s preferences. Automated checks are not beginner or assistive-technology research.

## Shape creation contract

**Create → Shapes…**, or **Choose a shape** on an empty artboard, opens a visual palette. Basic presets: Rectangle, Rounded rectangle, Circle, Ellipse, Triangle, Diamond, Polygon, Star and Line. Decorative presets: Capsule, Arrow, Heart, Cloud and Speech bubble. Named buttons expose selected states. Preview and parameters are draft-only; **Add shape** creates one history operation. Cancel/Escape, invalid input and a detached cancelled callback create nothing.

Width/height are 2–4096 local units. Circle has one Size field. Rounded rectangles/speech bubbles have a corner radius bounded by their dimensions. Polygon sides/star points are whole numbers 3–12; star inner radius is 10–90%. Line is an open two-point centerline with editable solid stroke width 0.1–128, round caps and no fill. The picker sets solid hex fill/line color; existing paint/stroke controls remain available afterwards.

At the root, a shape is centered on the active artboard. A selected unlocked group/bone becomes its parent, with local 25/25 placement. Locked ancestors, incompatible parents and cross-board requests reject. A changed project, selection, mode or revision rejects a stale draft. Success selects the new layer; Undo removes the whole addition and Redo preserves its identity. The compact sheet is full width with sticky heading/actions; desktop parameters sit beside the visual choices.

`@evir/authoring` exports `SHAPES`, `shapeGeometry(preset, options)` and `addShape(project, preset, options)`. Rectangle retains its existing kind. Other filled presets become ordinary closed cubic paths; Line becomes an open stroked path and upgrades source only on successful addition. Points have independent IDs. There are no new runtime types or preset schema fields.

**Preset parameters are creation settings.** This does not preserve live star/polygon/radius constraints, add Boolean operations, holes/compound paths or broaden animated-geometry import. Existing Scale/point/paint controls edit the result. Rive files are unnecessary for creating artwork.

## Beginner workflow

Learn has ten steps with expected results, plain-language definitions, a control reference, optional advanced topics and troubleshooting:

1. Project menu → New → Create project; name **First bounce**, keeping 640×480.
2. Add a 96-unit yellow Circle from Shapes.
3. In Design, name it **Sun**, X=120, Y=220.
4. Animate → Timeline → + Animation; **Bounce**, 60 FPS, 120 frames.
5. Frame 0 → Key property `y` → Set key, remembering 220.
6. Frame 60 → Properties Y=100, recording a key.
7. Frame 120 → Properties Y=220.
8. Playback settings → Loop, Continuous, speed 1 → Apply.
9. Play/Pause and inspect frames; easing is an optional experiment.
10. Save editable source (normally `.evir-project.json`); export `.riv` separately.

The new **Frame** field is preview state and never saved. It accepts whole frames within the animation duration. Enter or leaving an edited field seeks exactly, even if a fractional paused clock rounded to the same displayed number. Playback/scrubbing update the number unless it is being edited. Short-landscape Timeline/Machine buttons retain accessible names when CSS hides text.

The guide explains modes, layers/grouping, position, drawing, point editing, keys/easing, playback and source/export differences. Compact instructions explain closing one drawer before opening the next. Examples are optional later learning material; `learn/#open-example` remains valid. Open Studio keeps the guide in its current tab and opens the workspace in a new tab; the browser acceptance checks this handoff. Studio Help links to the lesson without new configuration.

`first-bounce.evir-project` is the exact completed lesson: one editable circle, no assets, three Y keys, a two-second loop and unchanged Design Y=220. Learn images are real Studio screenshots captured by completing the lesson. **Pocket garden**, original MIT artwork made with the same shape factory, contains a smiling sun, clouds, heart, speech bubble and three star-petal flowers with rounded pots: 38 named editable nodes, separate sun/flower motion and no imported image/font/Rive assets. Its poster is an actual renderer capture.

The measured 29-study expanded index placed the first previews at y=849.125 in an 844-pixel desktop viewport. The gallery now uses a compact native Browse studies disclosure (also implemented in PR #39, now merged). [WAI disclosure](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) and [MDN details](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/details) were retrieved/read before this change. Keyboard activation and actual-visibility lazy loading are checked; the test no longer assumes a fixed collection size. Scrubbing also refreshes Properties, so displayed values match the preview without rebuilding the playhead control.

## Evidence and reproduction

[Scoped evidence](../research/results/shape-library/) records hashes, browser/runtime provenance, source/native fixtures, actual Studio downloads and screenshots. Tests cover all presets, boundary geometry, stroke retention, parent/board/lock rules, rejection, history, source/native round trips and exact lesson values. Browser acceptance repeats the blank-project lesson at 320/390 portrait, 844×390 landscape and 1440 desktop. Public Learn checks cover keyboard disclosures, anchors, real image/source delivery, custom subpaths, overflow and automated accessibility.

The native oracle compares all presets/boundary variants, finished lesson, actual Studio lesson export and garden against official Rive 2.44 Canvas/WebGL2, using raw RGBA, MAE <2.5, coverage difference <350 and nonempty geometry. Cloud software rendering does not establish device performance or human usability.

```sh
node apps/web/generate-examples.mjs
EVIR_CAPTURE_EXAMPLE=garden EVIR_CAPTURE_EXAMPLES_ONLY=1 node tools/capture_site_assets.cjs
npm run web:build
node --test tests/editor/shapes.test.mjs
node tests/editor/shapes-browser.cjs
npm run web:build
node tests/site/learn.cjs
npm run validate:shapes
```

The browser workflow captures Learn images and the edited lesson export: run it before the final web build/native oracle. Full required gates remain `test:editor`, `test:web`, `test:experience`, `validate:editor`, `test:runtime` and `runtime:build`. Physical tests stay postponed; backend implementation stays deferred.

The cloud machine’s system Chromium 151 did not match pinned Playwright 1.63’s Chromium 153 (revision 1243). Two older aggregate browser flows timed out, while unchanged diagnostic reruns passed. The [official executablePath guidance](https://playwright.dev/docs/api/class-browsertype#browser-type-launch-option-executable-path) recommends the bundled version. Final checks explicitly select that downloaded build; three older workflows now honor the existing `CHROMIUM_PATH` override. This is an environment correction, not proof of the original timeout’s cause; assertions and pixel thresholds were retained.

Playback, stroke and skin-weight validators now transfer raw RGBA as Base64 bytes instead of protocol arrays of individual numbers, retaining comparisons and thresholds and adding byte-length guards. The final two-backend playback rerun reproduces all 41 pre-change Canvas clock, pixel and coverage measurements exactly; see the scoped transport report. The validation ledger also retains the aggregate editor timeout, unchanged library diagnostic, separately completed remainder and hosted-CI billing block.

The [main-sync integration record](../research/results/shape-library/main-sync/README.md) covers the subsequent merge of PR #39 into this branch, preserving Lumen/direct blends alongside Pocket garden/shapes and the new Learn page. The combined gallery has 30 studies.
