# Import, original-file viewing and agent setup

Research and implementation: 13 October 2026. This addresses the reported `DataConverterSystemNormalizer at byte 163` rejection and the missing Live tools/MCP instructions. All physical tests remain postponed.

## Why that import failed

The error matches `28745-54500-character-poses.riv`, one of the supplied exports. The [existing corpus inventory](../research/results/advanced-authoring/supplied-import.json) recorded the same type and byte offset. It is an editable conversion limit, not evidence of a corrupt file. Rive's normalizer performs direction-dependent data conversion; dropping it would change semantics. That export also contains many other features and exceeds the editable reader's record budget. Supporting one object alone would not make it a complete editable import.

[Primary-source provenance](../research/import-guidance/sources.json) records official Rive parameter/asset-loading documentation, MCP local-server setup, the pinned runtime API definitions and the normalizer implementation. An attempted old asset-loading URL returned 404; the current loading-assets page and local versioned APIs were reviewed instead. The official runtime remains pinned to `@rive-app/canvas@2.44.0`; its MIT notice accompanies hosted assets.

## Choose editing or original viewing

| Studio action | Result |
| --- | --- |
| **Open project** | Opens editable `.evir-project` JSON. Existing `.riv` selection remains supported for conversion. |
| **Import .riv for editing…** | Attempts strict supported-feature conversion. A successful conversion asks before replacing the current project. |
| **View .riv file…** | Opens the original in a read-only viewer, preserving the current Studio source and the original bytes. |

Unsupported editable conversion opens a bottom sheet with a plain-language reason, an expandable technical diagnostic, **View original animation**, **Download original .riv** and **Back to Studio**. It no longer leaves the user with only a parser toast. The empty artboard visible in the reported screenshot remains the user's current document; no partial imported document is installed.

The original viewer offers artboard/motion selection, Play/Pause, Reset and up to 32 legacy state-machine inputs when available. It starts paused. Data-binding property controls are not generated; some originals need those controls or referenced assets to reproduce their complete experience. Artboard and motion lists are bounded to 100 entries. Original bytes download unchanged; this viewer does not create editable Evir layers or extend Evir's renderer/format compatibility.

The official JS/WASM renderer loads only after explicit viewing. Both primary and fallback WASM assets come from the same host. Referenced asset fetching and the Rive asset CDN are disabled; embedded assets load, and missing referenced resources are reported. Viewing/import budgets remain 32 MiB. Closing, replacing a view or leaving the page cleans up the Rive instance, observer, buffer and canvas backing surface. A loading generation prevents obsolete/timeout callbacks from becoming ready; a failed load permits retry. A hidden page pauses motion and requires explicit playback to resume. The runtime module can remain cached for later viewing; cleanup is not a claim that the browser releases its entire WASM heap.

The [actual supplied-file check](../research/results/import-guidance/supplied-view.json) confirms that the character-poses export rendered its default artboard, exposed nine animations and one state machine, and left Studio source unchanged. Only metadata/hash/results are published, not the private artwork or file. This establishes read-only viewing in cloud Chromium, not editable conversion, complete interaction parity or physical-device performance.

## Live tools: usable without writing JSON

Open **Project menu → Live tools…**. The sheet labels the current feature a **local preview prototype** and states that no external agent is connected. The initial guide is visible:

1. **Grant local access** to the current editable project/artboard.
2. **Add compass lesson** for a working example, or choose **Project motion** from the existing project.
3. Check **Allow preview motion**, choose **Play preview**, then use **Pointer speed** in the demo.
4. Pause or Stop when finished. Closing revokes access. Authored scene changes remain in the project and share Studio Undo; presentation inputs/controls remain transient.

The guide collapses after a successful demo so the preview takes priority. Status and results use plain language. Motion defaults off; the Play control requires motion consent. The JSON console and context data sit inside **Advanced command console**, with **Load example command** generating a current scoped envelope. Revision checks and explicit Stop remain the existing shared command authority; this is not a new remote connection or permission system.

## MCP: visible setup, separate local process

**Project menu → MCP setup…** and the link within Live tools open a setup sheet. It explains the purpose, desktop prerequisites, local-server configuration, the Compass sample and source transfer back into Studio.

Install Node.js 24/Git, clone the repository and run `npm ci`. Enter the full local checkout path to generate a `mcpServers` configuration for a client that supports stdio servers. Paths support Unix/macOS and Windows. Copy or download the configuration, then enable/restart the server in that client. Configuration formats vary by host; there is no automatic installation or named-client compatibility claim.

Ask the agent to inspect first, then use the returned context/revision for edits or controls. `get_scene_snapshot` returns a `project` object; save that object as editable JSON and open it in Studio. To use another source project, change `--project` to its full local path. The process edits separate memory and does not save files automatically. There is no hosted MCP endpoint or connection to the live browser document. Authenticated pairing, model/voice orchestration and backend services remain future work.

See [the command contract](33-local-commands-and-mcp.md) for protocol/tool details. There are no new deployment environments or frontend variables. The single `apps/web` host still imports independent Studio packages at `/editor/studio/`.

## Checks and remaining scope

[Browser evidence](../research/results/import-guidance/browser.json) covers two widths, source preservation, converter feedback, original Play/Pause/Reset pixels, byte-exact download, supported editable import, malformed originals, lazy/same-origin loading, MCP configuration/download and automated accessibility. The [ledger](../research/results/import-guidance/validation.json) records the broader regression checks. These do not substitute for human, assistive-technology or physical-device studies.

General Editor-file conversion and a live MCP-to-Studio bridge remain open. This increment removes the dead end, documents the boundary and makes the existing local prototype learnable.
