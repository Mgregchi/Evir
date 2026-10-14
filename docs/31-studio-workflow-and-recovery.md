# Studio workflow and browser recovery

Research and implementation: 12 October 2026 (Africa/Lagos). This increment improves editing and large-project handling within the existing single web host. Source/runtime schemas, supplied brand artwork and hosting configuration remain unchanged.

## Research and decisions

[Primary retrieval provenance](../research/studio-workflow/sources.json) records resolved URLs, status, byte counts and hashes. Rive's [Hierarchy](https://rive.app/docs/editor/interface-overview/hierarchy) describes nesting and front-to-back ordering. [Selection and navigation](https://rive.app/docs/editor/interface-overview/selection-and-navigation) supplies existing hierarchy/navigation context. Evir implements its own workflow against its supported source model; this is not a claim of identical Rive interactions.

[MDN drag and drop](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API) distinguishes internal dragging, transferred data and accepting drop targets. Only an active internal layer drag can change Studio structure; external text is not interpreted as editing commands. [WCAG dragging guidance](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) requires a single-pointer alternative. The organization sheet supplies the same placement operations, and graph positions retain numeric fields.

[IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) offers asynchronous, transactional object storage. [Storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) explains Web Storage limits, browser-specific IndexedDB quotas and possible eviction. Studio's permitted embedded assets can outgrow its old localStorage recovery slot. IndexedDB therefore replaces that slot; it does not guarantee permanent storage. Keep downloaded backups. [DOM-size guidance](https://web.dev/articles/dom-size-and-interactivity) supports limiting mounted controls. [requestIdleCallback](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback) is not universally available and needs a timeout for required work; this implementation uses a portable 250 ms debounce and explicit flushing instead.

## Using the new controls

- **Layer placement:** on desktop, drag a visible layer row near another row's top/bottom to place it above/below. Drop in the middle of a group/bone to nest. A selected ancestor carries its descendants once; multiple roots retain their relative order. Collapse groups or use search to bring destinations into view. **Organize… → Above/Below a sibling → Reference layer** performs relative placement with tap/keyboard controls. Front/back and parent selection remain available. Locks, cycles, cross-artboard targets and invalid rig attachments reject through one history transaction.
- **Distribution:** select at least three independent layers using Multiple, then **Properties → Distribute horizontal/vertical**. The outermost bounds stay fixed and gaps become equal, including overlapping/negative gaps. Hidden or locked members reject. Each action is one undo step. Persistent guides and key-object alignment remain separate improvements.
- **Animated parent changes:** reparenting between static parents with matching rotation/scale bases offsets X/Y keys while preserving easing and sampled world poses. The shared authoring operation protects both Inspector and Organize paths. Animated ancestors or changed rotation/scale bases that need general rebasing reject explicitly. This is not arbitrary animation baking or general affine animation rebasing.
- **Timeline:** Previous/Next key navigates the selected layer's tracks, or all tracks when no layer is selected. It selects the nearest strictly earlier/later key and stops playback; boundary controls disable. Existing key value/easing editing remains available.
- **State graph:** click a node, or focus and press Enter/Space, to inspect that state without changing the runtime's active state. Fit graph includes negative/distant positions; Focus state brings one state into view. Drag a node to reposition it with connected edges following; release creates one undo entry. Escape, cancellation and lost capture discard the draft. Graph X/Y fields provide a drag-free alternative. Graph views are temporary; graph positions retain their existing editor-source representation and are stripped from runtime exports.
- **Long layer lists:** at most 120 rows mount per page. Previous/Next layers browse pages; search filters the entire hierarchy. Home/End and arrow selection navigate across pages, and stage selection reveals the selected page. Paging/search preferences do not enter scene exports. This bounds layer controls, not every timeline or asset control.

**Arrange** is a new original public study: six mint/peach/forest cards with editable groups, a real captured poster and a compatible export. Try selecting card 1/2/3 and distributing horizontally, then relative layer placement and Undo. Milo/Signal remain useful timeline/graph studies. The gallery now contains fifteen original studies.

## Recovery and memory behavior

Recovery writes sample the latest committed project after a 250 ms debounce. Writes serialize; completing an older write cannot mark a newer project saved. Saved status follows transaction completion, not request success. Visibility changes/page hiding request a flush, but browser termination can still interrupt a write. Failure retains the open project and offers a custom download-recovery message.

On startup, Studio reads the IndexedDB recovery record, validates it and verifies asset digests. If no record exists, it reads the old `evir.studio.project.v1` localStorage copy. That legacy copy is removed only after the IndexedDB write commits. Existing small layout/snapping preferences remain in localStorage. This increment originally used one browser-local slot. The subsequent [browser project library](37-browser-project-library.md) replaces that slot with separate entries and prevents stale tab overwrites through atomic revision checks. Accounts, collaborative merging and backend storage remain deferred.

History versions now share unchanged immutable records. Callback candidates and public snapshots remain detached; canceled/failed edits cannot mutate retained versions. A returned-to-start gesture adds no undo entry and preserves redo. History retains its existing bounded step count. This reduces duplicate retained documents, while candidate/public snapshots still allocate and large asset decodes can dominate peak memory.

Drawing indexes child order, masks, feathers and transforms once per unchanged pose. Bone offsets and inverse binds retain their prior semantics; skin weight/tendon lookups use the pose-scoped resolver. Resolver data must not be reused after mutation. Stage ordering uses the same traversal. Idle scenes still do not acquire a continuous rendering loop. This is a Canvas optimization, not a replacement GPU renderer.

## Evidence and reproduction

[Workflow evidence](../research/results/studio-workflow/) contains responsive browser tasks/screenshots, before/after process profiles and the final validation ledger. Browser tasks cover distribution/undo, relative placement, native desktop dragging between visible rows, timeline navigation, graph keyboard/focus/drag/undo, migration and a 1,000-node recovery project with a 4 MiB asset. That encoded project exceeds 5 MiB; IndexedDB restores its nodes and exact asset digest/length. No supplied third-party artwork is redistributed.

Profile commands:

```sh
node --expose-gc tools/profile-workflow.mjs --baseline
node --expose-gc tools/profile-workflow.mjs
npm run test:editor
npm run validate:editor
npm run test:runtime
npm run runtime:build
npm run test:frontend
npm run test:web
npm run test:experience
```

The profile compares pinned baseline `7375759` History/traversal against current implementations, sharing current model validation. Each of three trials runs in a fresh Node process on the cloud machine, with 1,000 rectangles, 30 edits and one 128 KiB asset. Fixture hashes match. Timings and forced-GC heap deltas describe this workload, not browser peak memory, frame rate or physical devices. Compare the retained reports instead of assuming the ratios apply universally. Automated axe and keyboard checks do not replace assistive-technology or human sessions.

Measured medians in this cloud run:

| Workload measure | Before | After |
| --- | --- | --- |
| 30 history edits | 454.15 ms | 200.91 ms |
| Forced-GC retained heap delta | 34.31 MiB | 1.89 MiB |
| 100 scene-order traversals | 472.40 ms | 10.85 ms |

## Remaining work

General animation rebasing, persistent guides/key-object alignment, broader timeline/asset control virtualization and multi-project/tab-safe local recovery remain improvements. RML round-trip authoring, the shared declarative command layer and local live-agent/MCP prototype are later tracks. Richer feature/import parity and physical-device/matched-Editor/human evidence remain as recorded in the [consolidated plan](25-studio-navigation-and-remaining-work.md). Backend services remain deferred.
