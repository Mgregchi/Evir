# Structured guides and reference spacing

**Canvas view → Guides & grid → Rows & columns** adds reusable guide patterns. Add Columns or Rows, then expand the component to edit it. Each pattern has its own visibility and snapping switches, count, gutter and margin. Fixed sizing uses a width/height and Start, Center or End alignment. Stretch divides the available artboard space evenly; width/height and alignment controls are disabled because their values do not determine that mode.

The sheet reports the calculated track size and first position. Apply saves the artboard's browser preferences; Cancel discards the draft. Duplicate creates a separate pattern with a new ID, and Remove retires one from the draft. Lock guide positions prevents pattern structure and geometry changes while retaining visibility/snap controls. Manual ruler guides and the uniform grid remain available.

These patterns do not move or resize scene nodes automatically. They are geometric overlays for authoring, separate from runtime layout containers. Edges and centers snap within six screen pixels; hold Alt to bypass snapping. Global Show guides and Snap to guides switches affect the patterns too. A pattern that no longer fits after an artboard resize stops drawing/snapping until corrected. Apply requires all configured patterns to fit.

## Fixed reference spacing

Select two or more independent roots with Multiple in Layers. Choose **Properties → Alignment reference → Keep [layer] fixed**. Distribute horizontal/vertical now opens a bottom sheet with **Fixed gap**. Give the other selected roots equal gaps around that reference in their current geometric order. A locked reference may stay stationary, but moving members must be visible, unlocked and supported by the existing affine move contract.

Gap is nonnegative, finite and at most 1,000,000 artboard units. Applying prepares all moving members first and makes one source/history change. Invalid inputs or selections keep the sheet open and leave source unchanged. Cancel keeps the original positions. Undo/Redo restores/reapplies the operation. Without a reference, existing three-root distribution retains the outside edges and calculates equal gaps, including overlap.

This uses world-space geometric bounds; a rotated/sheared parent does not turn the gap into a local-axis measurement. It does not introduce general animation rebasing or IK-aware placement. The reference choice and dialog draft are editor session state, outside exported scene contracts.

## Presets, compatibility and budgets

Guide preset version 2 adds `components` to the existing switches, uniform grid and manual guide list. Version 1 presets and stored preferences upgrade without changing their old positions, IDs or grid values. Downloads use version 2. Guide preferences retain their existing browser-local cache and the 32 recently saved project/artboard scopes; no environment variables or backend services are added.

Up to eight components may contain 1–32 tracks each: at most 256 bands / 768 component snap candidates. Manual guides keep their 64-item budget. Fixed track size is 1–10,000, gutter 0–10,000 and margin 0–1,000,000 artboard units. Stretch calculates a positive size from `(extent - 2*margin - (count-1)*gutter) / count`. Fixed patterns must fit between the margins. Drawing clips bands to the artboard and skips bands outside the visible range. Searching existing scene snap targets retains the earlier binary-search approach; component candidates stay bounded.

Source `.evir-project` files and native `.riv` exports contain no guide patterns. Presets are separate downloadable files. Changing preferences does not consume scene Undo or change export bytes; applying distribution changes authored positions and is exported normally.

## Research and an original example

The [retrieval register](../research/structured-guides/sources.json) records primary documents, response hashes and observed claims. Penpot documents viewport-only square/row/column guides, counts, gutters, margins and fixed/stretch alignment. Adobe documents alignment/distribution relative to a key object and even spacing. Rive documents responsive layout containers that position runtime content; those are a separate engine contract. A Figma help request was denied, so no feature claim is taken from it. Evir's numeric budgets and stable-order spacing algorithm are explicit product choices.

**Loom** is the twentieth original gallery study: six woven mint/peach/forest patches around a turning spindle. Its [source](../apps/web/assets/examples/loom.evir-project), [native export](../apps/web/assets/examples/loom.riv), [guide preset](../apps/web/assets/examples/loom.guides.json) and actual Canvas poster are original project work.

Open Loom and import its guide preset. Select patch 1 1, reference patch and patch 1 3. Keep reference patch fixed, then Distribute horizontal with gap 28. The outer patches move to the fixed column bands at X=84 and X=332; the reference stays at X=208. Undo restores the offsets. The preset also provides two horizontal bands; snapping against them is a separate authoring action. The Weave loop and all source geometry remain editable.

## Validation

[Browser evidence](../research/results/structured-guides/browser.json) covers 320×844, 390×844, 844×390 and 1440×844: parameter/fit rejection, duplicate/remove, lock, pointer snapping and Alt bypass, source/export isolation, fixed reference, cancellation, Undo/Redo, reload/download and keyboard focus. Automated sheet axe checks report zero violations. Pure tests cover old-preset migration, component budgets, fixed/stretch geometry, hidden/Alt-bypass snapping, affine world spacing, stationary locked references and atomic rejection.

Official Rive Canvas and WebGL2 scenarios compare Loom keyframes and an exported fixed-gap result with Evir's source pose. The [validation ledger](../research/results/structured-guides/validation.json) records completed commands, fixture/runtime hashes and actual cloud software graphics provenance. Reproduce with `npm run test:editor`, `npm run validate:editor`, `npm run test:frontend`, `npm run test:web` and `npm run test:experience`. For a focused UI run after building, use `node tests/editor/structured-guides-browser.cjs`.

Physical-device tests remain postponed. Automated browser work does not establish human/screen-reader usability, real mobile memory/GPU performance, general runtime reflow, broader Editor import or full renderer parity. Hosted backend remains excluded.
