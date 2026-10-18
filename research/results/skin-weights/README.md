# Graphical skin-weight evidence

Application/fixture/browser-test source: `d1c660a73f2c97cf3402c93ce9ec879f16f00962`, based on main `8efe5d2` (merged PR #35). This is independent of the unmerged contour-import PR #36. See [the workflow and contracts](../../../docs/43-graphical-skin-weights.md).

`browser.json` records synthetic editing at 320×844, 390×844, 844×390 and 1440×900. It covers numeric independent handle weights, invalid targets, reachable bottom sheets, brush preview/whole-stroke history, geometry preservation, Escape/pointer cancellation/simulated hidden rollback, second-finger navigation, mesh weights, rebinding, export and recovery. A stroke starts from frozen visible control positions and source influences; radius is measured in screen pixels. The landscape workflow uses the visible Fit action before painting a source saved at camera zoom 1.

The gesture test checks the exact target weights at both swept endpoints and observes provisional pose changes before interruption. Its two touch points must remain on the stage; a point outside the viewport cannot establish two-finger stage navigation. The sampled source retains asset bytes and geometry. The generator gives each translated coordinate its own array so coincident anchor/handle references do not accumulate an offset.

Actual Studio screenshots:

- [Compact weight controls](weight-sheet-390.png)
- [Short landscape weight controls](weight-sheet-844.png)
- [Compact painted controls and footer exit](weight-overlay-390.png)
- [Desktop painted controls](weight-overlay-1440.png)

`studio-weighted.evir-project` and `studio-weighted.riv` come from the actual desktop UI workflow. The focused oracle also checks the published original Gust. Each has a separate animation-free rest export, because the official high-level Rive host initializes its first clip even when paused. The four oracle source/native pairs and `native.json` carry source/native/asset hashes.

The focused comparison uses original and edited three-bone vector/mesh scenes at frames 0/30/60/90/120, plus the two rest poses: 12 comparisons per official Canvas/WebGL2 backend, 24 total. Every pose must contain more than 10,000 covered pixels. Preset gates are MAE < 2.5 over RGBA byte values and coverage difference < 350. Evir prepares the embedded PNG before rendering; official runtimes read the same embedded resource.

The final validation ledger and copied current gallery/public-site/experience reports record the broader gates. Earlier research snapshots are preserved rather than overwritten with outputs from this run. Gust's artwork and small generated weave are original MIT project work. No supplied stock/corpus image or altered brand artwork is included.

The initial incomplete gallery run was canceled after a short CPU profile located the dominant samples in Playwright's per-pixel protocol-object validation. Harness commit `8f74434e07169490dd9ba3594fc0295036d2e05d` transfers the identical raw RGBA bytes as base64 strings instead. A second run passed gallery and motorcycle stages but was canceled at the same higher-resolution transfer in the character checks. The subsequent harness commit applies the same transfer before the existing character SHA256 calculation. The final restarted web suite retains all pixels, hashes, comparisons and thresholds and checks decoded buffer lengths. The ledger records both canceled attempts separately; neither is counted as a completed suite pass. Completed command logs and their hashes are included under `logs/`.

All checks use cloud Chromium, with SwiftShader software graphics for WebGL2. Automated accessibility, simulated touch/lifecycle and callback checks do not replace physical-device, human or screen-reader evidence. Physical tests remain postponed and hosted backend remains deferred.
