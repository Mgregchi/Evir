# Backend and live agent sessions — proposed architecture

Research reviewed 11 October 2026. This records the user's live teaching/storytelling vision and the backend recommendation. **Proposal, not a shipped backend, MCP server, collaboration system or AI integration.** Today's independent engine packages run locally; Studio's project persistence is browser-local. See the [earlier agent/platform research](15-ai-agent-authoring-research.md) and [retrieval provenance](../research/live-agent-sessions/sources.json).

## What the backend would own

Keep `apps/web` as the single frontend host and Studio at `/editor/studio/`. A separately maintained service would own accounts and project access, saved revisions, assets/exports, and live-session coordination. Rendering, input response and animation ticks stay in the user's runtime. Neither a changed landing page nor an agent connection should require changing the renderer.

The leading hosting option is Cloudflare Workers, SQLite-backed Durable Objects for each live session, D1 for account/project metadata, and R2 for large source snapshots, assets and compiled exports. These map to the existing Cloudflare deployment context and documented responsibilities, rather than introducing a second frontend deployment. Core commands and storage interfaces should remain portable packages. Authentication/provider configuration belongs to the service; frontend configuration should remain limited to the service address when necessary. There is no new environment variable in this increment.

| Responsibility | Proposed owner | Boundary |
| --- | --- | --- |
| Identity, memberships, project access and revision pointers | API service + D1 | Enforce access per operation; an OAuth identity provider is still to be selected. |
| Immutable source snapshots, asset bytes and exports | R2, referenced by content digest | Scoped upload/download; do not persist every frame or camera move. |
| Ordered edits, session membership, revision/event sequence and resume | One Durable Object per session | Commit authority lives here; D1 stores discoverable metadata, not a competing live edit log. |
| Studio editing and audience presentation | Browser hosts importing shared packages | Consume revisions and input events; render locally. |
| Agent access | MCP adapter over the same command service | Remote Streamable HTTP, rather than a second implementation of editing logic. |

Cloudflare's primary source overviews describe transactional Durable Object storage, multi-client coordination and WebSocket hibernation, D1's managed SQLite service, and R2's object storage. Direct documentation requests returned 403; the official documentation repository supplied the content. These establish a plausible fit, **not** measured latency, availability, cost or recovery for Evir. Provider limits, region/data requirements, identity and a workload prototype still precede a production commitment.

## Agent tools, not agent-specific scene formats

An external agent pairs to an explicit project/session/artboard with scoped, revocable access. It should not infer the target from whichever Studio tab happens to have focus. The same serializable command layer must serve human editing, backend requests and MCP tools. Today Studio accepts JavaScript callbacks in history transactions; those are **not** already a remote command API. Extracting bounded declarative commands is the first engineering prerequisite.

Proposed tool names below are design examples, not discoverable tools today:

| Tool | Purpose |
| --- | --- |
| `inspect_scene` | Return stable IDs, revision, supported feature/input contracts and selection context. |
| `apply_scene_patch` | Apply a bounded atomic set of typed authoring commands against `expectedRevision`, with `requestId` for idempotent retry. |
| `play_animation` / `set_input` | Play supported authored motion or set a boolean/number/trigger input. |
| `expose_controls` | Declare semantic controls and bindings for the audience host. |
| `capture_frame` | Request a bounded preview rendered by an available host and return its revision/cue identity. A headless render service would be separate later work. |
| `get_session_events` | Read input/edit/readiness events since a sequence number; adapt narration through the agent host. |

Validate complete candidate scenes before committing. Return a new revision, changed IDs and diagnostics; retain the last valid scene if an edit fails. Conflicts should return the current revision and affected IDs rather than silently overwriting another person's changes. Do not accept arbitrary JavaScript, HTML, filesystem access or unrestricted URLs as scene commands. Existing supported transforms, curves, keys, machines and static paints remain the limit; adding MCP does not add meshes, text shaping, import or advanced state-machine semantics.

Use a bounded command/event history with periodic snapshots. Retries must not create duplicate objects or undo entries. A reconnect supplies its last applied sequence; the service sends missing events or a fresh snapshot if the replay window expired. Presence and cursor movement are ephemeral, coalesced and separate from durable scene revisions. Multi-user editing initially uses explicit revision conflicts; CRDT convergence and semantic rebasing need their own research and acceptance rather than being promised by choosing WebSockets.

## Agent-defined audience controls

The agent chooses the semantics and bindings. Evir offers supported control types and rendering defaults, while an integrating host can present its own UI using the same manifest and input API. For example:

```json
{
  "schemaVersion": 1,
  "sessionId": "lesson-orbits",
  "sceneRevision": 12,
  "controls": [
    {
      "id": "orbit-speed-control",
      "type": "slider",
      "label": "Orbit speed",
      "min": 0,
      "max": 2,
      "step": 0.1,
      "binding": { "machineId": "orbit-machine", "inputId": "speed-input", "inputType": "number" }
    }
  ]
}
```

This is a proposed **presentation manifest**, not a valid current `.evir-project` field. A number input only affects visuals if authored machine/data behavior consumes it; the current engine does not automatically support speed-driven blending. The first lesson demo could use the existing play/pause operation and boolean state changes, then add more expressive behavior as its contracts ship.

Labels, types, bounds, defaults and target IDs must validate together. A slider responds locally through its binding; routine interaction does not wait for an LLM round trip. User events are sequenced back to the agent host when useful for narration. The host supplies keyboard/touch access, focus order, reduced motion, responsive control drawers and accessible names. No Evir-specific hard-coded 'lesson controls' are required, and no agent-supplied executable UI is required for these declarative controls. Durable authored interaction contracts are saved deliberately; transient session controls/playback and Studio preferences stay separate from scene exports.

## A live lesson or story

1. The user starts a session and chooses live presentation access. The agent creates or modifies a draft scene through validated commands.
2. The audience host applies the revision, prepares assets, renders and acknowledges `visualReady` with a `cueId` and revision. Narration can wait for this acknowledgment rather than referring to a missing scene.
3. The host starts the corresponding narration segment and animation against the same media clock. Cue IDs, ready acknowledgment and the media timeline coordinate visuals; tool completion alone does not guarantee audiovisual synchronization.
4. The agent exposes supported controls. A user pauses motion or changes a bound input immediately; the host records an input event.
5. The host's orchestration decides when an agent should react, update its explanation, or generate the next scene. Restart/resume reconstructs a valid scene and input state without replaying consumed triggers twice.

Maintain two operation contexts: **authoring**, where patches form reviewable draft/undo transactions, and **live presentation**, where the user has granted an explicitly scoped session permission for immediate transient scene changes. A visible connection/status and Stop control let users end live access. Saving into a durable project, publishing or widening access remain distinct operations. Evir's tool server supplies capabilities; it does not itself provide an LLM, speech synthesis or a complete storytelling orchestrator.

## What MCP and MCP Apps provide

The [MCP architecture](https://modelcontextprotocol.io/specification/2025-11-25/architecture) makes the host responsible for model integration, lifecycle and orchestration. [Tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) define named/schema-described operations, structured results and errors. [Streamable HTTP](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports) supplies remote request/response and optional server events; the browser's live WebSocket session is a separate application connection. MCP does not prescribe a narration clock or guarantee that a user event wakes an autonomous agent. That requires a host/event-consumption contract. Resource notifications or polling can help, but capability support must be negotiated and tested.

For a protected remote server, [MCP authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization) specifies OAuth resource-server/client roles and discovery. Implement that contract through an established provider/SDK; do not mistake a session ID for authentication or ship a secret in frontend environment variables. The exact provider and supported clients remain open decisions.

[MCP Apps](https://modelcontextprotocol.io/extensions/apps/overview), with its [official extension SDK](https://github.com/modelcontextprotocol/ext-apps), lets tools associate an interactive `ui://` HTML resource. A supporting host renders it in a sandboxed view and relays tool results and UI tool calls. An Evir presentation view could therefore appear alongside chat narration as well as in our own web host. This is an **extension**: a generic MCP client does not necessarily render it, support its display modes, permit the same networking, or deliver a voice synchronization API. The SDK lists supporting products; none has been exercised with Evir here. Use negotiated support and a scene-link/plain-result fallback. Capability, content-policy, network and media behavior need client-specific acceptance.

## Engineering sequence and acceptance

1. **Shared commands and local session prototype:** stable context, atomic patch validation, revision preconditions/idempotency, grouped undo, typed control manifests and a live presentation view. No hosted account service needed to test these contracts.
2. **Independent persistence/API service:** identity/access, asset and source storage, saved revisions, backup/restore and ownership. Test unauthorized cross-project operations and concurrent save recovery.
3. **MCP + live-session bridge:** one paired agent and one audience, then a second editor. Test conflict, cancellation, malformed/oversized commands, reconnect, duplicate requests/events and clean disposal. Add a compatible MCP Apps view once ordinary tools work.
4. **Narrated teaching/storytelling demo:** explicit ready cues, media-clock synchronization and locally responsive controls. Test slow assets, dropped connections, narration interruption, Stop and resume. Measure latency and memory on real devices; test keyboard/touch/assistive technology with people.
5. **Broader collaboration and agents:** multi-user merging, richer data bindings, provider orchestration, cost/quotas and publication follow measured prototype results. Existing renderer/authoring development continues alongside this work.

Do not label these systems closed until there is runnable source, supported client/version evidence and recovery/interaction measurements. This increment captures the architecture and new product workflow; it does not deploy a service or change the public site's configuration.
