# Ordered direct blending and Lumen

19 October 2026. Studio adds ordered direct blends to the existing animation/1D workflows. The runtime, native adapter, browser Studio and gallery share this contract. The single host remains `apps/web`; no hosting variables, backend or physical tests are added.

## Research before implementation

[Primary-source retrieval](../research/direct-blends/sources.json) records successful files, failed lookup paths and hashes at runtime commit `7aa93402a27c800db8a36acc8672612c100ea9b1`. The pinned [direct-state implementation](https://github.com/rive-app/rive-runtime/blob/7aa93402a27c800db8a36acc8672612c100ea9b1/src/animation/blend_state_direct_instance.cpp), [state template](https://github.com/rive-app/rive-runtime/blob/7aa93402a27c800db8a36acc8672612c100ea9b1/include/rive/animation/blend_state_instance.hpp), [property accumulator](https://github.com/rive-app/rive-runtime/blob/7aa93402a27c800db8a36acc8672612c100ea9b1/src/animation/blend_accumulator.cpp) and generated direct-child defaults were read alongside Evir's runtime and earlier [research-only direct probes](08-complex-rendering-and-feathering.md).

Rive's [state guide](https://github.com/rive-app/rive-docs/blob/18744eb41501f7014b2fb7c1c4a7b6719120e507/editor/state-machine/states.mdx) describes direct/additive states, fixed-value baselines and independent number properties. The implementation determines the exact tested behavior: each percentage clamps to 0–100, rows apply in order to the currently stored property, and zero-weight rows do not reset that property. The direct implementation does not perform the 1D reset operation. A fixed-value row defaults to **100**, not zero. Clocks advance even when a row has zero weight.

For two poses at x=64 and x=192 with weights 75% and 25%, explicit ticks give x=96, 102, 103.125 and 103.3359375. This is sequential interpolation with retained state, not a normalized weighted average or a sum of offsets. Setting both weights to 100 makes the last row win; setting both to zero retains the previous x. An explicit 100% baseline keys the properties that should return to rest each tick.

[WCAG dragging guidance](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) informs numeric fields, selectors and Move up/down buttons. Reordering needs no drag. Bottom sheets, sticky actions, focus restoration, existing reduced-motion transitions and custom inline errors follow the project's interaction choices.

## Studio workflow

1. Open **Lumen**, select **Interact**, and open **Machine** on compact screens.
2. Use **Test joy** and **Test courage** between 0 and 100. **Play motion** advances the breathing, expression and wing clocks together. Test values are presentation state; they never change saved defaults.
3. Open **Blending & timing…**. **Make a feeling blend input → Direct · ordered weights** shows three rows. Rest uses a fixed 100%; Joy binds to joy; Courage binds to courage.
4. Choose each row's animation and either **Fixed percentage** or a number input. Move rows with the named buttons. Add up to eight rows; keep at least two. The first row also supplies the state's legacy animation reference.
5. **Apply** validates the whole transaction. One Undo restores the previous bindings/order; Redo restores the edit. Cancel changes no source and returns focus. Invalid weights show an error in the sheet and preserve the project. If validation rebuilds the Machine panel, focus returns to its replacement opener. A closed sheet's detached Apply callback is inert; a changed machine rejects a stale draft.
6. Save source or export `.riv`. Reload restores authored rows, not test values, a running clock, a sheet or a persistent runtime pose.

The mode selector still supports Single and 1D. Existing source-authored intermediate 1D children remain intact when another field changes; the legacy two endpoint animation selectors remain available. This increment does not add a complete 1D graph editor.

## Shared contract and native mapping

A direct state uses `blend: {type:'direct', children:[...]}`. Each ordered child has `animationId` and exactly one of `weight` (a finite fixed percentage in 0–100) or `inputId` (a number input in the owning machine). There are 2–8 children, all animations belong to the same artboard, and `state.animationId` matches the first child.

This increment supports **one state with no transitions in a direct machine**. Direct children cannot also drive ordinary or 1D states: those native clips have different reset/key-scope requirements. Use separate timelines. Other machines retain their existing ordinary/1D behavior. Nested blends, timed transitions into/out of direct states, multiple concurrent machine layers, data-bound weights, synchronization groups and random states remain open. Fixed-count clip repetition retains the existing host-policy limitation.

`MachinePlayer.advance(dt)` applies the ordered rows once, including an explicit zero-duration tick. `pose()` only reads a detached pose: repeated painting, inspecting or pausing does not apply another weight. Reset restores authored defaults and initializes a fresh direct pose. Runtime forks clone accumulated properties, clocks and inputs; speculative local commands cannot change their parent on rejection. The memory holds only the current value of keyed properties, not an unbounded tick history. Rendering applies constraints after the mixed property values; there is no feedback from solved IK into the next raw blend tick. General large-scene performance and richer constraint interactions still need their own evidence.

Native export writes `BlendStateDirect` and ordered `BlendAnimationDirect` records. Input rows reference numeric input indexes. Fixed rows use `blendSource=1` and `mixValue`; import also recognizes an omitted fixed mix as the upstream default 100. Data-bound rows and unsupported flags reject explicitly. Supported native direct files become editable source and export back to the same tested semantics; this does not establish general Editor-file import.

The first timed Lumen oracle exposed an exporter interaction: Evir ordinarily pads clips with default keys to clear stale values when switching single poses. Padding direct clips caused later rows to overwrite unrelated earlier motion. Direct children now retain their **authored sparse key scope**, while all previous gallery exports remain unchanged. Native hosts playing these partial clips individually must establish/reset their starting pose, as with any sparse native clip. The source contract rejects sharing the same clip across direct and ordinary/1D states rather than silently changing those states' behavior.

## Original vector study

**Lumen — a little courage** is original MIT artwork: a lavender firefly with curved mint wings, dark eyes, a peach lantern and a moonlit garden. Forty-eight named nodes include editable filled paths and two small retained antenna strokes; no stock/reference pixels, fonts, PNG layers or altered brand artwork appear in the scene. The poster is an actual Evir Canvas capture.

Rest restores the shared keys and gently bobs the body. Joy tilts the head and broadens the smile. Courage flutters both wing groups. The website exposes independent keyboard-accessible percentage sliders and **Reset feelings**. A reduced-motion preference keeps motion paused; offscreen/hidden previews use the existing scheduling cleanup. Preview repaint uses `pose()` instead of an extra `advance(0)`, so drawing itself is not a hidden blend tick. Existing public examples use the same read-only repaint path.

## Validation and reproduction

```sh
node apps/web/generate-examples.mjs
EVIR_CAPTURE_EXAMPLE=lumen EVIR_CAPTURE_EXAMPLES_ONLY=1 node tools/capture_site_assets.cjs
npm run test:runtime
npm run runtime:build
npm run test:frontend
npm run test:editor
npm run test:web
npm run test:experience
npm run validate:editor
```

Focused commands are `node --test tests/runtime/direct-blends.test.mjs`, `node tests/editor/direct-blends-browser.cjs` and `npm run validate:direct`. Run the browser workflow before the final native oracle: it exports a real edited Studio scene that the oracle requires. The consolidated npm gates also restore the contour-import browser/oracle checks promised by the import guide.

Tests distinguish ordered accumulation from normalized weighting, zero-weight retention, full-weight precedence, clamping, fixed baselines, sparse key scopes, child clocks/speed/loop modes, idempotent reads, isolated reset/forks and rejected local commands. The responsive workflow also caught an unnamed Machine/Timeline rail button when short-screen CSS hides its text. The rail now keeps an explicit accessible name matching its mode. The workflow covers 320/390 portrait, 844×390 landscape and 1440 desktop, with actual source/native downloads, recovery and automated accessibility. The gallery validates both exposed controls and keyboard reset behavior.

The native oracle compares independently encoded input/fixed/default-value scenes, Evir exports, color blending, Lumen and the actual Studio edit against official Canvas/WebGL2 2.44 runtimes at explicit ticks. It also activates a previously zero-weight motion after its clock advances and clears inputs after a pose changes. Private pinned-runtime stepping belongs only to the research harness. The pixel limits remain MAE <2.5, covered-pixel difference <350 and nonempty visible coverage. [Scoped results](../research/results/direct-blends/) contain hashes, runtime/browser provenance and completed checks. Cloud software rendering and automated accessibility do not establish physical-device, human or screen-reader evidence. Physical tests remain postponed and hosted backend remains deferred.
