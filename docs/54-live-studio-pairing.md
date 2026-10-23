# Live Studio pairing through MCP

22 October 2026. This follows the merged account/authentication increment, PR 42 (`5f41c2d`). The owner authorized continuing with authenticated live Studio editing. Physical-device tests remain postponed. Source retrievals are in [the ledger](../research/live-studio/sources.json).

## What is connected

The existing web Worker serves MCP and account endpoints. D1 holds account/grant/session metadata. A Cloudflare Durable Object relays requests to **one explicitly shared, open Studio tab** over a hibernation-capable WebSocket. It persists only session identity/alarm metadata; it does not store scene requests, responses or offline edits. The browser remains authoritative for source, Undo and presentation state. This is a single-owner live bridge, not cloud project storage or multi-user collaboration.

The model/authoring/runtime packages stay independent. A shared pure discovery contract now supplies the same scene tool schemas to local stdio and hosted MCP. Both browser hosts execute the existing `CommandSession`; there is no separate backend geometry editor or arbitrary-script evaluator.

## Cloudflare setup: the existing Git connection

**No new environment variables, secrets, local commands or manually created Durable Object namespace are required.** Keep the [existing dashboard setup](53-cloudflare-accounts-and-mcp.md): Git-connected production `main`, the same build/deploy commands, `D1_DATABASE_ID`, dashboard-managed runtime settings and exact configured OAuth callbacks.

The next production deployment applies append-only D1 migration `0002_live_sessions.sql`. Wrangler deploy also applies the checked-in `live-session-v1` Durable Object migration and binds `LIVE_SESSIONS` automatically to the exported `LiveSession` class with SQLite-backed storage. Dashboard variables/secrets remain preserved and repository runtime-value overrides remain rejected. Do not replace the Git deploy command with a bare Worker upload. Use an isolated namespace/database/origin for any future previews; production previews remain disabled.

The added namespace is a Cloudflare resource managed by the code, not an additional frontend application. Actual hosting/account authorization and deployment have not been exercised from this workspace. Check the Cloudflare build log and its resource permissions if provisioning is rejected; do not run migrations manually or reset D1.

## First live session

1. In your MCP client, connect to `https://evir.idey.click/mcp` (use your configured origin if different). Use [automatic registration](55-mcp-client-registration.md) where supported, or the optional predefined public-client setup from the account guide. New authentication challenges request `account:read scene:read scene:write scene:control`; consent explains these permissions. An existing account-only connection must be reauthorized. Its token is never silently upgraded.
2. Sign in to Evir with your passkey and approve the connection. An OAuth grant alone does not expose any Studio file. Account-only clients can still request only `account:read` explicitly.
3. Open `/editor/studio/` and the project you want to share. From **Project menu → Live agent connection…**, choose the named agent connection. Project reads include the whole project; edits target the current artboard. Enable editing and/or animation/control access only if wanted. Choose 15 minutes or one hour, then **Share this project**.
4. The pairing sheet closes. A small, modeless **sharing live** preview has **Stop sharing** and **Minimize live preview** controls. Studio remains editable; human changes and Undo invalidate stale agent revisions. Keep this tab open. There is no automatic retargeting to another focused tab.
5. Ask the agent to call `list_live_sessions`, select the intended session explicitly, and call `inspect_scene` before editing. For example: **“Inspect my shared Explorer project. Create a looping wave on its right arm, then expose a speed slider called Narration speed. Keep the other layers unchanged.”** It must discover actual node IDs and revisions rather than paste guessed IDs. The [captured working source](../research/results/live-studio/live-wave.evir-project) demonstrates that workflow through real hosted transport in the software test.
6. Choose **Allow live preview motion** if you want animation. The agent cannot switch on that checkbox. Audience sliders/buttons/checkboxes bind locally to typed animation or machine inputs and are reported back as sequenced events. No LLM round trip is needed for each audience change.
7. **Stop sharing**, project/artboard switching, socket loss or lease expiry ends live access. Signing out stops that account's active shares; account recovery or revoking an agent also closes affected shares. Already accepted edits remain and can be undone. Reconnection requires an explicit new share; there is no offline work queue.

The account link opens in another tab. If signing in or reauthorizing there, return to Studio and reopen the pairing sheet to refresh the connection list. Local **Live tools…** and stdio MCP remain available separately. Starting the local preview stops a remote share, and starting a remote share stops the local preview.

## Permissions and tools

| OAuth scope | Additional Studio permission | Tools |
| --- | --- | --- |
| `account:read` | None | `get_connection_status` |
| `scene:read` | Read this project | `list_live_sessions`, `inspect_scene`, `get_scene_snapshot`, `get_session_events`, `stop_session` |
| `scene:write` | Edit this artboard | `apply_scene_patch` |
| `scene:control` | Play/control this session | `expose_controls`, `play_animation`, `set_input`, `set_control` |

Write/control OAuth scopes require `scene:read`; all grants include `account:read`. A Studio lease can grant a smaller set than OAuth permits. Every scene call carries a root `sessionId`. Existing mutation envelopes additionally retain `schemaVersion`, `context`, `requestId`, `expectedRevision` and `payload`; context must match that session/project/artboard. Snapshots may include source editor state/assets and other artboards, so grant project reading deliberately. Unknown or mismatched tools/arguments are rejected; scene operations still pass the shared model and command validation.

## Delivery and visual readiness

A broker permits one in-flight tool call per shared session. Missing Studio sockets return `STUDIO_OFFLINE`; overlap returns `BUSY`. Browser WebSocket responses have a one-MiB transport limit (scene payloads are capped below it); requests are bounded to 96 KiB. MCP HTTP results include both structured content and compatibility text, so that HTTP representation can be larger. Larger source snapshots fail with `RESPONSE_TOO_LARGE`; use paged inspection and keep the source in Studio.

A browser acknowledges an operation after execution. Source mutations form one shared Undo transaction; idempotent successful retries use the same `requestId`. Reusing an ID for different data rejects. A retry whose original cue has been superseded keeps its original cue ID, reports `presentationSuperseded`, and never claims another operation’s visual readiness. Human edits, switching context and provisional human edits preserve the existing conflict/`BUSY` rules. A ten-second delivery timeout or lost socket returns **`DELIVERY_UNKNOWN`**: an edit may already have applied. Inspect first and, if retrying, reuse the original mutation ID and payload. No automatic replay or rollback is performed. A request accepted before revocation may already have completed; Stop blocks subsequent application in the tab.

`cue.ready` becomes true only after the matching pose is prepared and drawn in a visible, expanded live preview. Minimized/hidden previews do not acknowledge readiness and schedule no animation frames. Restoring visibility redraws and may produce `visual_ready`. Reduced motion is respected by an initially-off motion control. Motion requires explicit opt-in even when the agent requests playing. Narration, voices, a media clock, MCP Apps rendering inside commercial clients and frame capture are not supplied by this bridge. The agent host must coordinate its own narration with returned cues/events; tool completion alone does not prove audiovisual synchronization.

Metadata is capped at three active shares per account and fifteen-minute/one-hour leases, bounded by OAuth/browser-session expiry. Tab ownership uses a separate random, memory-only key whose hash is in D1; it travels in WebSocket subprotocol headers, not URL parameters. The server validates origin/account/grant/lease/key before upgrade and rechecks grant/lease permissions for calls and socket messages. The user can always stop the browser share locally even if its HTTP cleanup fails. The server socket closure, alarm and expiry checks prevent an old lease being used for a replacement project. Expired metadata is removed by scheduled cleanup; revocation takes effect before physical cleanup.

## Evidence and remaining work

[Acceptance, logs and actual Studio captures](../research/results/live-studio/README.md) distinguish synthetic OAuth-client/workerd/D1/Durable Object tests from named client pairing, a production Cloudflare deployment, physical devices and human screen-reader/usability sessions. Those external observations have not been invented.

Open: named ChatGPT/Claude/other-client pairing beyond the implemented [registration](55-mcp-client-registration.md) and curated [published-identity/signed-assertion profile](56-published-client-identities.md); dedicated audience/presentation pages or MCP Apps; media/narration orchestration; cloud project persistence; multi-user coordination/recovery; real-device/human evidence. This implementation does not claim a CRDT, durable command log or offline editor synchronization.
