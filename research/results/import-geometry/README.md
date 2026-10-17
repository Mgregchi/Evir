# Editable native contour evidence

This increment is based on `8efe5d2` (merged PR #35). Application, fixture and browser-test source is recorded at `9d203378524d43a9f374017b8d857297021cd01d`. The final evidence commit also adds CI path coverage for the independent fixture helpers. See [the contract and reproduction guide](../../../docs/42-editable-riv-contours.md).

`native.json` records 100 selected comparisons: 50 per official backend, split between imported Evir rendering and native re-export against independently encoded original Rive records. There are 13 native fixtures, including the original Tide study. Twelve focused fixtures use 256×256 artboards; Tide is rendered at half scale from its 512×512 artboard. Animated fixtures use named clips at frames 0/30/60/90/120. Static fixtures contain no animation, avoiding the high-level Rive host's automatic first-clip initialization.

Every original pose must render more than 1,000 covered pixels. The mixed skin fixture has two bones with independent incoming-control bindings; both rest and moving geometry must be visible. The preset limits are MAE < 1.5 over RGBA bytes and coverage difference < 250 pixels. This is selected geometry evidence, not full renderer/Editor parity.

Each fixture has its original `.riv`, canonical editable `.evir-project` and `-reexport.riv`. Hashes in `native.json` identify the exact bytes. Tide's independently encoded original sample and ordinary Evir re-export also ship in the public gallery. Its artwork is original project work under the MIT license; it was not exported by the Rive Editor. No additional uploaded artwork is copied into this directory.

`browser.json` records real compact/desktop Studio automation: original native sample → 34 editable layers → point editing/undo/redo → compatible export → animation scrub → rejected animated geometry without source replacement → browser recovery. Screenshots:

- [Desktop imported Tide with editable cubic handles](studio-tide-1440.png)
- [Compact imported Tide workspace](studio-tide-390.png)
- [Compact unsupported geometry explanation](unsupported-geometry-390.png)
- [Desktop unsupported geometry explanation](unsupported-geometry-1440.png)

The recovery assertion compares serialized numeric values: JSON normalizes `-0` to `0`. The compact workflow opens Timeline before scrubbing. Neither fixture adjustment changes production recovery or timeline behavior.

The validation ledger and copied current gallery/public-site/experience reports record the completed broader gates. Existing historical research snapshots are retained at their original revisions rather than overwritten by this run.

All graphics run in cloud Chromium; WebGL uses SwiftShader software rendering. Automated WCAG/keyboard checks are not human or screen-reader evidence. All physical testing remains postponed. Hosted backend work remains deferred. The [corpus inventory](../../import-geometry/corpus-geometry.json) is type-frequency evidence; the supplied SOBO file still rejects on unsupported data contracts.
