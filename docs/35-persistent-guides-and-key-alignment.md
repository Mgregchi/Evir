# Persistent guides, a uniform grid and fixed-reference alignment

13 October 2026. This increment extends Studio positioning workflows and adds the original Measure study. The web app remains the single host; engine/source versions do not change.

## Research and decisions

[Rive rulers and guides](https://rive.app/docs/editor/design/rulers-and-guides) documents per-artboard guides that are excluded from `.riv` exports, ruler dragging, visibility, locking and snapping. It also documents structured row/column/grid guide components. Evir implements manual horizontal/vertical guides and a uniform grid in this increment; reusable Rive guide components and asymmetric rows/columns are outside this scope.

[Rive alignment](https://rive.app/docs/editor/fundamentals/align-and-distribute), already researched in [the alignment foundation](26-studio-alignment-and-snapping.md), documents a stationary key object with other selected objects moving to it. A fresh source check confirms that behavior. [Adobe Illustrator alignment](https://helpx.adobe.com/illustrator/using/moving-aligning-distributing-objects.html) provides a corroborating reference. Evir makes the reference explicit in a Properties selector so choosing it works with a single pointer and keyboard. Stage double-click-to-key and key-based distribution are not included.

[Penpot's interface guide](https://help.penpot.app/user-guide/first-steps/the-interface/) supports keeping secondary controls around a central workspace. [WCAG dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) requires a single-pointer alternative to dragging. Evir offers numeric guide creation/positioning and Inspector alignment, alongside optional ruler dragging. These sources inform the interaction; automated checks do not establish human or assistive-technology usability. Fetch dates, HTTP status, sizes and hashes are in [the source register](../research/studio-guides/sources.json).

## Using the features

Choose **Canvas view → Guides & grid**. The bottom sheet belongs to the active artboard. Add a vertical or horizontal guide, enter its artboard-unit position and choose **Apply**. Visibility, rulers, guide snapping and position locking have separate switches. **Cancel** discards the draft. Guide preferences have no scene History entries; scene Undo still reverses layer moves and alignment.

To use rulers, enable **Show rulers** and **Edit guides on canvas**. In Design with Select, drag from the top ruler for a vertical guide or the left ruler for a horizontal guide; drag an existing visible guide to reposition it. **Escape** cancels an active gesture. **Stop editing guides**, or Escape with no active gesture, returns to ordinary selection. Pan and two-finger navigation keep their existing behavior. Position locking disables numeric add/remove/edit and canvas dragging; locked visible guides still serve as snap references.

The **Uniform grid** has spacing and X/Y origins, with separate display and snap switches. Spacing is 1–10,000 artboard units. Layer edges/centers snap within six CSS pixels to the nearest available guide/grid/object target. Object snapping retains its existing Canvas view switch. Hold **Alt** to bypass all snapping. Hiding guides and grid bypasses their snaps; hiding one guide excludes just that guide. These snaps operate on Design selection moves, preserving exact numeric moves, Pen controls and animation keys.

Preferences are stored in `evir.studio.guides.v1`, keyed by project and artboard IDs, retaining the 32 most recently saved pairs. They are excluded from `.evir-project` and `.riv`. **Download guide preset** saves the sheet draft as an independent version-1 `.guides.json` file; **Import guide preset** prepares a replacement for Apply. Reset also remains provisional until Apply. A preset is required to carry guides with a project to another browser. Storage failures preserve in-memory use and explain how to download a preset.

Select two or more independent roots, then choose **Properties → Alignment reference → Keep [layer] fixed**. Left/Center/Right/Top/Middle/Bottom move the other roots to that reference's bounds. A peach outline marks the reference. **Selection bounds** restores the existing collective alignment behavior. A locked reference is allowed; locked moving members, hidden members, different artboards, singular moving-parent transforms and incompatible bone attachments reject the whole operation. Selected descendants move with their selected parent once. One scene Undo restores an alignment.

## Limits and bounds

Guide presets reject unknown fields/versions, duplicate IDs, invalid axes, non-finite positions and positions beyond ±1,000,000. There are at most 64 guides per artboard and 64 KiB per imported preset. A corrupt browser cache falls back to default preferences without altering the scene. This is local preference recovery, not synchronized guide storage or a backend service.

Grid snap positions are calculated arithmetically. At low zoom, visible grid lines thin out; configured snap spacing stays unchanged. Drawing is clipped to the artboard with at most 512 lines per axis, and ruler ticks are bounded. Scene snap arrays stay captured and sorted once per gesture: object targets continue to use binary search, while guide/grid candidates are bounded independently of scene size. The large-array unit check verifies that guide snapping does not scan 100,000 object targets; it is not a device performance benchmark.

Alignment uses the existing axis-aligned control-envelope bounds, not exact Bézier extrema or effect-inclusive visual bounds. This does not expand native geometry/export parity. Rulers and guides are Studio canvas overlays; their appearance is not promised inside runtime viewers, public gallery previews or native exports.

## Original example and acceptance

**Measure — a little balance** adds three independently grouped peach/forest/mint cards and a subtle Balance loop. The gallery supplies editable source, compatible `.riv`, a real Canvas poster, inspection instructions and a separate guide preset. Import the project and preset, select card 1/reference card/card 3, keep reference card fixed and Align top; Undo returns their original offsets. No uploaded artwork is redistributed.

Run `npm run test:editor`, `npm run validate:editor`, `npm run test:frontend` and `npm run test:web`. Guide units cover strict presets, scope isolation/recovery/eviction/storage failure, zoom/Alt/visibility behavior, bounded grid drawing, large-target binary search and locked-reference affine alignment with Undo. The new browser workflow covers 320/390 portrait, 844 landscape and 1440 desktop: numeric/ruler editing, cancellation, custom validation, preset download/import, actual grid snapping, reference alignment, preference recovery, source/export isolation and automated WCAG checks. The gallery oracle additionally checks Measure's original and key-aligned exported composition with official Canvas2D/WebGL2 runtimes.

Completed counts and hashes belong in [the validation ledger](../research/results/studio-guides/validation.json); screenshots and native comparison evidence are in [studio-guides](../research/results/studio-guides/). All physical tests remain postponed. Screen-reader/user sessions, matched external Editor scenes and hosted backend/remote-agent sessions remain open in [the consolidated plan](25-studio-navigation-and-remaining-work.md#remaining-work--current-plan).
