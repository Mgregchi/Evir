# Local commands and MCP prototype

Research and implementation: 12 October 2026. Physical tests are postponed by the user. This increment implements a shared command package, Studio's opt-in local command console, a local stdio MCP adapter and an original Compass study. Hosted backend services, remote pairing, voice narration and MCP Apps remain future work.

## Research first

[Primary-source retrieval](../research/commands/sources.json) records outcomes and hashes for MCP tools, lifecycle and stdio transport at protocol revision **2025-11-25**, and MDN BroadcastChannel. The schema.json endpoint returned 404 and supplies no schema evidence. The implemented discovery schemas are Evir's own command shapes; project validation remains authoritative for geometry and references.

MCP tools support structured results, text compatibility and tool errors. Stdio uses newline-delimited UTF-8 JSON-RPC with logs on stderr. Initialization precedes tool calls. BroadcastChannel has same-origin/storage-partition restrictions; that is not a pairing or authentication mechanism. Evir therefore introduces no automatic cross-tab pairing or network endpoint. These sources establish contracts, not tested compatibility with a particular model client.

## Two local hosts, one command implementation

| Host | How to use it | Scope |
| --- | --- | --- |
| Studio | Project menu → Live tools → Grant local access | The current project's actual Undo history and selected artboard. `window.evirStudio.live` becomes usable only after this visible grant. |
| Local MCP process | Run the command below, then connect a stdio-capable host | A host-selected project file loaded into separate process memory. It does **not** connect to the open Studio document. |

```sh
npm ci
npm run mcp:local -- --project apps/web/assets/examples/compass.evir-project --session lesson-compass
```

A stdio client can use this server configuration, replacing the absolute paths with its checkout:

```json
{
  "mcpServers": {
    "evir-local": {
      "command": "node",
      "args": ["/absolute/Evir/tools/mcp-local.mjs", "--project", "/absolute/Evir/apps/web/assets/examples/compass.evir-project"]
    }
  }
}
```

This is a generic configuration example, not a claim that a named client was paired. The server reads one host-selected file (maximum 2 MiB) and makes no file writes or outbound network calls. Read source through `get_scene_snapshot` to export the in-memory result yourself. It has no accounts, credentials, deployment variables, backend database or HTTP listener.

The adapter exposes `inspect_scene`, `get_scene_snapshot`, `get_session_events`, `apply_scene_patch`, `expose_controls`, `play_animation`, `set_input`, `set_control` and `stop_session`. Initialize and send `notifications/initialized` before tools. The implementation supports the stdio lifecycle/tool subset; it does not advertise resources, prompts, subscriptions, elicitation, sampling, tasks or frame capture. Transport messages are bounded to 256 KiB, command arguments to 64 KiB and source responses to 2 MiB. Oversized transport input discards through its newline and permits the next request. A stopped process must be restarted to grant a new session. Default session IDs are generated per process; use a new ID on restart if supplying `--session`, since retry storage is process-local.

## Edit and control contract

Inspect first to discover `{sessionId, projectId, artboardId}`, current revision and stable IDs. Mutation tool arguments contain:

```json
{
  "schemaVersion": 1,
  "context": {"sessionId": "lesson-compass", "projectId": "compass-project", "artboardId": "compass-board"},
  "requestId": "rename-needle-1",
  "expectedRevision": 0,
  "payload": {
    "commands": [{"op": "update_node", "nodeId": "compass-needle", "changes": {"name": "Direction pointer"}}]
  }
}
```

For Studio's `live.execute`, additionally include `"operation": "patch"`. MCP's `apply_scene_patch` selects that operation. After any successful operation, use the returned revision for the next one; inspect again after conflicts. Session revisions cover source edits **and** inputs/control/play operations, so an evicted trigger retry remains stale. `sceneRevision` tracks source History separately. Identical successful retries return their original result without another edit/input. Reusing an ID with changed data rejects. History's provisional human edits reject with `BUSY`; human commits and Undo invalidate presentation bindings and emit `human_edit`.

Patches apply 1–64 operations as one validated Undo transaction. Invalid geometry/references, cycles, occupied sibling order, locked targets or mismatched scopes leave committed source unchanged. Available commands create/update/remove/reparent nodes, create animation/machine, and set keys/playback. This initial interface covers supported existing node geometry but does not add asset uploads, rig weight operations or an arbitrary script evaluator. Runtime forks preserve clock/transition/input state so a failed speculative input cannot alter the last valid presentation.

Audience manifests contain 1–16 controls bound to one animation or one machine. Slider/checkbox/button types match speed/number/boolean/trigger contracts. Labels render as text; there is no agent-supplied HTML or JavaScript. Range/step values and stable binding IDs validate together. Session controls, play state and live inputs do not enter `.evir-project` or `.riv` exports.

## Studio workflow and readiness

Grant access, then **Add compass lesson**. The complete scene is one Undo entry; repeated additions use new IDs and free sibling orders. The preview's **Pointer speed** slider comes from the shared manifest. Check **Allow preview motion**, then **Play preview**. Movement is opt-in even if reduced motion is not requested. Play/pause and controls stay in the sheet; the ordinary authoring stage remains available after closing it. A sheet provides labeled controls, keyboard focus containment, custom errors and a responsive single-column layout. Closing it or selecting Stop revokes access and disposes resources. Replacing the project/artboard never retargets the grant.

A cue starts pending. The browser acknowledges it only after preparing the matching source revision and drawing its pose; stale preparation completions cannot acknowledge a newer cue. Hidden documents pause scheduling; resumed frames avoid accumulating hidden time. The event log holds 256 edit/control/readiness events, including audience values. Large patches cap changed-ID lists at 100 with `changedTotal` recording the full count; if `resetRequired`, inspect a fresh state. Tool completion alone is not a narration cue. The stdio process has no renderer and therefore never claims `visual_ready` or emits frame captures. Audio synchronization, presentation recovery and automatic event delivery to an agent host are still open.

## Evidence and next scope

[Software browser checks](../research/results/commands/browser.json) cover 390/1440-pixel layouts, explicit grant/Stop, the manifest speed control, motion consent, source isolation, pending/ready cues, custom errors, one-step Undo, overflow and automated accessibility. [Validation ledger](../research/results/commands/validation.json) records package/stdio/unit regressions and official-runtime comparisons. Actual device measurements, human usability and screen-reader results are not claimed.

The gallery now has **seventeen original studies**. Compass includes [editable source](../apps/web/assets/examples/compass.evir-project), native export, a real captured poster and [command/manifest recipe](../apps/web/assets/examples/compass.commands.json). A recipe contains payloads, not a complete envelope; fill context/request/revision from inspection and use new IDs/order when inserting into an existing scene. Gallery play uses the authored default loop; Studio adds transient audience speed control. Native `.riv` exports contain scene/animation, not this control host.

Remaining software work includes extending command coverage, explicit authenticated transport/pairing and recovery, host event orchestration, authoring guides/brush/path workflows, richer engine/import contracts and multi-project recovery. Hosted backend remains deferred. Physical tests remain postponed and do not block these increments.
