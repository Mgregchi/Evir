# Remaining work across Evir

Current register: 23 October 2026. Use this document for planning; older research reports preserve their dated experiments and are not current backlogs. The navigation/workflow detail remains in [guide 25](25-studio-navigation-and-remaining-work.md). “Implemented” below means the declared bounded software contract, not universal Rive parity or observed production behavior.

## Already implemented

The single web host imports the independent Studio at `/editor/studio/`. Public pages, original showcase artwork and editable examples, preview metadata, custom feedback, loading/recovery states and responsive sheets/drawers exist. Studio supports 14 shape presets, retained shape controls, cubic/compound/Boolean paths, guides, freehand, native solid and gradient/skinned strokes, basic text/assets, rigs/meshes, one-to-eight-bone unit-scale IK, automatic/smoothed/locked skin weights, timelines, loops/speed/component playback and bounded state-machine blending. The gallery includes original characters and the controllable motorcycle. Browser project recovery/library and bounded layer navigation are implemented.

Worker/D1 passkey accounts, recovery, OAuth, automatic registration, authenticated MCP, explicit Studio pairing, shared edit/Undo controls and visual-ready cues are implemented. [Published client identities and signed proofs](56-published-client-identities.md) extend that service. Rendering, format, authoring and runtime packages remain independent; this service does not store durable cloud projects.

## Remaining software

| Area | Remaining contract / next work |
| --- | --- |
| Editable `.riv` import | Expand beyond the [bounded native contour/stroke subset](42-editable-riv-contours.md): animated contour geometry, rounding/path flags, transformed skinned contours, broader compound/layout/data-converter/ViewModel/data-binding contracts, external assets, audio/scripts and multi-layer machines. Preserve explicit diagnostics and original-file viewing for unsupported content. A runtime export cannot reconstruct `.rev` editor history. |
| Authoring and large projects | Freehand gesture concatenation; general animation rebasing when reparenting animated objects; remaining human editing operations in the typed command layer; broader inspector/timeline/control virtualization. Current layer paging, local project recovery and static-parent workflows are already implemented. |
| Rendering | Inner feather/offsets and native GPU vector rendering research. Current outer feather/Canvas approximations do not establish Rive Vector Feathering or universal renderer equivalence. Validate quality before extending the contract. |
| Rigging and animation | IK with nonunit scale, stretch/shear and overlapping/interdependent constraints; nested blend graphs, transitions involving direct states, general weighted animation layers/masks, multi-layer machines, broader listener actions and transition interruption. Current direct rows, timed/1D blends and looping/component playback are implemented. |
| Text and assets | Rich text/runs, paragraph layout, variable axes/modifiers and broader shaping/fallback parity. Broader external-asset formats, animated mesh topology and UV wrapping outside the current normalized range need separate contracts. |
| Durable backend | Cloud project snapshots/revisions, asset storage, permissions/workspaces, backups/restore and project metadata. Live pairing is an opt-in browser bridge, not a durable scene repository. R2 remains an architectural option, not an existing dependency. |
| Collaboration | Presence, multiple editors, durable command journal, reconnect/resume and semantic conflict handling. The current owner + agent share one browser's edit history; no general collaborative merge/CRDT contract is shipped. |
| Account and service operations | Self-service account deletion/data export, registration lifecycle/owner/fleet policies, retention/observability and broader abuse controls. Current passkey/recovery, grants, refresh and revocation remain supported. |
| Connector breadth | Additional CIMD publishers/trust policy or signing algorithms when needed; general native/DCR callback contracts beyond the narrow Claude Code published identity; optional key registration for non-published clients. Scope step-up/lazy authentication and newer protocol capabilities need explicit host-driven contracts. Current MCP resources/prompts/subscriptions, elicitation, sampling and tasks are not advertised. |
| Live teaching/storytelling | Dedicated audience/player hosting or supported-host MCP Apps view; frame/image capture for agent visual context; narration/TTS/media clock, cancellation/interruption/resume and host event orchestration. Build an actual teaching/storytelling demo. Typed scene controls, edits, motion and cues are available already. |
| Learning and examples | Extend beginner lessons, control documentation and original examples alongside each newly supported contract. Existing first-animation lessons and gallery are implemented; do not substitute imported third-party art for feature acceptance. |

## External evidence still needed

These are not satisfied by automated local checks:

- Observe the Git-connected Cloudflare production deployment: D1 migration, resource permissions, dashboard-variable preservation and recovery from failed deployment. The deployment helper and migrations have local acceptance, but no production deployment is performed by this increment.
- Pair actual ChatGPT, Claude, Claude Code, Groq forwarding applications and other intended hosts. Record host versions, consent, scopes, refresh, Stop and publisher/key behavior. Synthetic OAuth/MCP flows and the public Claude Code metadata fetch do not establish named-host pairing.
- Obtain controlled, matched Rive Editor exports with equivalent geometry, rigs, state/data contracts and assets. Supplied complex scenes are exploration inputs, not equivalent benchmark fixtures. The supplied room-decor attachment exceeded the transfer tool's 32 MiB limit; do not count it as tested. General editable import remains bounded even where original-file viewing is available.
- Observe representative beginner/usability and screen-reader tasks. Automated axe, keyboard and responsive checks provide different evidence. Previously recorded intermittent browser click timeouts in [software closure](47-software-closure.md) also need continued diagnosis; a later passing run alone does not establish their cause or elimination.

## Physical testing — postponed

All real-device testing remains postponed by the user's instruction: desktop/mobile GPU quality and frame rate, loading, memory/heap, battery and device audit. Keep the existing runner available. Software-rendered cloud measurements and simulated touch must not be relabeled as physical evidence or made blockers for software increments.

## Later research and optional scope

General games/physics, scripting/audio, 3D, additional native-platform runtimes and marketplace systems are potential directions, not an implicit promise to implement every Rive product. Revisit primary sources and define acceptance before committing to each. RML exploration already includes official CLI probes; broader production authoring integration remains a choice. Evir already has an editable source format: a new binary format is not automatically required. Matched-scene and eventual device evidence should guide further compatibility/format decisions.

A practical next software sequence is: broaden editable geometry/data imports; complete remaining authoring/rig/blend/text contracts with original examples; then durable project storage/collaboration and a full live teaching demo. Named-host and human evidence can proceed alongside these. Physical work stays postponed.
