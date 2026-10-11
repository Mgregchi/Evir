# Freehand acceptance evidence

11 October 2026. [Research and supported contract](../../../docs/27-studio-freehand-shapes.md) distinguish the implemented solid-fill shape workflow from future brush/pressure/text/rendering features. [Primary-source retrievals](../../studio-freehand/sources.json) include successful responses and rejected URLs without treating failures as evidence.

- [Fitting experiment](fitting.json): four deterministic input families at three tolerances, reduced anchor counts, estimated sampled deviation, CPU fitting times and source/sample hashes. Reproduce with `node tools/measure_freehand.mjs`. These are cloud Node experiments, not physical-device or human-drawing results.
- [Browser report](browser.json): five portrait/landscape/tablet/desktop sizes, affine parenting, reviewable drafts, bottom-sheet options, focus/validation, undo/redo, cancel/blur and pointer ownership. Chromium-dispatched touch exercises one-finger drawing and second-finger cancellation. Injected coalesced samples exercise that API branch; they do not certify hardware event precision.
- [Authored source](authored.evir-project) and [actual downloaded export](authored.riv): source recovery and exact compiler-byte equality; official Canvas2D/WebGL2 2.44.0 pixel comparisons against Evir Canvas. GPU diagnostics identify cloud SwiftShader, not real GPU/mobile performance.
- [Mobile draft](draft-390x844.png), [mobile bottom sheet](drawing-options-390.png), [compact draft](draft-320x844.png), [landscape](draft-844x390.png), [tablet](draft-1024x844.png) and [desktop](draft-1440x844.png): real browser screenshots, visually reviewed. The sheet capture includes intentional custom validation feedback.

The original [Wisp study](../../../apps/web/assets/examples/wisp.evir-project) uses generated sample loops through the same fitter. Its [poster](../../../apps/web/assets/wisp-poster.png) is an actual Canvas render. No uploaded third-party artwork or brand remix is included.

The command logs and validation ledger retained here report completed local checks. Automated accessibility checks and simulated browser input do not establish screen-reader, physical-device or representative user-study results. The remaining-work plan keeps those evidence gaps open.

[Validation ledger](validation.json): 44 editor unit tests and eight browser workflows; 14 frontend tests; 40 broader authoring export checks; 104 gallery comparisons and seven editable-study round trips. Logs: [editor](editor.log), [freehand](freehand.log), [authoring oracles](authoring-oracles.log), [frontend](frontend.log), [web](web.log), [experience](experience.log) and [build](build.log). [Gallery oracles](gallery-oracles.json), [round trips](gallery.json) and [public-page checks](public-pages.json) retain the corresponding results.

[Live preview recheck](live-preview.json) records that the homepage now emits both image tags after PR #21 was merged. This establishes the deployed HTML, rather than platform-rendered cards or cache invalidation.
