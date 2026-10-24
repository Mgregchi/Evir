# Connect agent hosts with automatic registration

22 October 2026. Continues the merged account and live Studio work (PRs 42–43). The owner authorized Cloudflare Worker/D1 accounts, Git-connected dashboard deployment and live MCP use. Physical-device testing stays postponed.

## Start here

The MCP endpoint is **`https://evir.idey.click/mcp`**. Use your configured origin if different. After the Git-connected production deployment, automatic registration works without adding `OAUTH_CLIENTS` or any other setting. Existing predefined clients remain supported.

| Agent host | Connection path | Evidence boundary |
| --- | --- | --- |
| ChatGPT | Add your custom MCP connection with OAuth. Use published identity/CIMD where available, or **DCR / dynamic registration**, then enter the MCP endpoint. Sign in with an Evir passkey and review consent. | OpenAI documents DCR as a supported alternative to its preferred published-identity/CIMD method. The exact builder menus and availability depend on product/plan. No live ChatGPT pairing was performed here. |
| Claude | Add a custom connector with the endpoint and OAuth. Under **OAuth client**, choose **Use Claude's published identity** or **Register automatically**. Sign in and review consent. | Claude's official help distinguishes this from **Use Claude's published identity** and **Use your own OAuth client**. No live Claude pairing was performed here. |
| Groq | A host application completes Evir OAuth, then supplies the resulting Evir access token in the remote MCP tool's `headers.Authorization`. The host handles refresh/reconnection. | Groq documents built-in remote MCP and authentication headers. A Groq inference API key does not authenticate an Evir account. No Groq API call was made here. |
| Other remote MCP clients | Use metadata discovery and DCR, authorization-code + S256 PKCE, the canonical `/mcp` resource and one supported client-auth method. | Protocol acceptance tests exercise these flows with synthetic clients; they do not establish every platform's compatibility. |

**Current update:** [published identities and signed assertions](56-published-client-identities.md) are now implemented for the curated ChatGPT/Claude OAuth origins, with narrow published Claude Code loopback support. Do not guess callback URLs. Automatic registration supplies the client's actual HTTPS callbacks; published clients must supply their real document. Named-host pairing still needs observation.

After OAuth consent, **open Studio → Project menu → Live agent connection**, choose the connection and explicitly share a project. OAuth registration and consent do not share artwork. Use [the live-session guide](54-live-studio-pairing.md) for permissions, controls, motion, Undo, Stop and delivery limits. `/account/` now includes these connection steps inside **How to connect an agent**.

## What changed

`POST /oauth/register` implements bounded RFC 7591 client registration. Authorization-server metadata advertises that endpoint and `none`, `client_secret_post`, `client_secret_basic`. Existing dashboard-defined clients keep their public-client/PKCE behavior. Dynamically registered clients live in D1; authorizing a person still requires passkey sign-in, explicit consent and a separate project share.

The new append-only `0003_oauth_clients.sql` migration runs through the existing Git-connected deploy command. No new runtime/build variables, signing secrets, manual SQL, namespace setup or owner-side Wrangler commands are needed. Dashboard settings remain preserved. Existing account, grant and token records remain compatible.

A registered client gets a random ID. Confidential clients receive a random secret once; only its hash is stored. The response sets `client_secret_expires_at: 0`. Registration metadata and client credentials remain stable across deployments and grant revocation. User access/refresh tokens retain their independent expiry/rotation; revoking a connection ends its grant rather than deleting an identity reused by other people. There is no registration read/update/delete API or automatic client-credential expiry. Keep credentials in the agent host's secure storage; never put confidential-client secrets in frontend configuration.

Registration does not verify that an app belongs to OpenAI, Anthropic or any other vendor. A client-provided name is untrusted text. The consent page explicitly says so and displays the exact callback destination, including query parameters. Continue only for a connection you initiated in the intended host. Secret authentication proves possession of that registration's credential, not ownership of a brand. DCR metadata does not cause fetching of client-supplied logos, metadata or JWKS URLs. The separate [published-identity profile](56-published-client-identities.md) fetches only its curated publisher documents/keys.

## Supported contract

- One to eight distinct, exact HTTPS callbacks: no credentials, fragments, wildcards or whitespace. HTTP/native loopback callbacks are not part of this hosted-web contract.
- A plain client name up to 120 characters; names render as text. Unknown metadata is ignored, not trusted or fetched. Client-supplied IDs/secrets are replaced with server-generated values.
- Authorization-code grants and an optional `refresh_token` grant; code responses only. Per RFC 7591, omitted grant types default to authorization code, omitted response types to `code`, and omitted token authentication to `client_secret_basic`. A client that wants refresh tokens must register that grant type.
- Registered scope limits bound later requests. Omitted registration scope permits Evir's advertised scopes; consent still approves the actual requested scopes. Unsupported email/profile/OIDC scopes are rejected; accounts require no email.
- All clients, including confidential clients, must use S256 PKCE and the canonical Evir `/mcp` resource. Token exchange checks the same client/callback/resource/challenge before consuming a code. Public clients cannot send a secret; confidential clients must use their registered method. Mixed authentication and duplicate form fields reject.
- Refresh tokens rotate and stay bound to their original client/grant/scopes. Revocation requires the same client authentication as token exchange and cannot revoke another client's grant. Authenticated cross-origin MCP requests must match that grant's callback origin or the Evir origin; changing clients does not inherit another grant's access.
- Registration is limited to 16 KiB, ten attempts per trusted Cloudflare IP hash per ten minutes, and 10,000 stored dynamic clients. Capacity/rate rejection leaves existing clients usable. These are bounded service controls, not a claim of comprehensive abuse prevention. Registration management/owner approval and broader fleet policy remain future work.

MCP initialization now returns the requested version when it is supported (`2025-06-18` or `2025-11-25`), with the latest supported version as the fallback for an unsupported initialization request. Invalid protocol-version headers still reject. This follows the published lifecycle negotiation rule.

## Research basis and product choices

[Source retrievals and hashes](../research/mcp-registration/sources.json) record the actual official URLs and redirects. Facts used:

- [OpenAI authentication](https://developers.openai.com/plugins/build/auth) documents metadata discovery, DCR/predefined/CIMD choices, supported authentication-method intersections, issuer identification and keeping registered credentials valid. It currently prefers CIMD but still supports DCR. Its callback mode can vary, so none was hardcoded.
- [Claude custom connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp) explicitly lists published identity, automatic registration and a supplied OAuth client as different settings.
- [Groq remote MCP](https://console.groq.com/docs/tool-use/remote-mcp) documents `type: "mcp"`, `server_url`, authentication headers, allowed tools and host approval. A forwarding host must acquire Evir OAuth credentials separately.
- [MCP authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization) describes preregistration, CIMD and optional DCR; [lifecycle](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle) requires returning a supported requested protocol version.
- [RFC 7591](https://www.rfc-editor.org/rfc/rfc7591) supplies registration defaults, responses and error semantics. [RFC 6749](https://www.rfc-editor.org/rfc/rfc6749) supplies Basic/form client authentication and authorization-code binding; [RFC 9700](https://www.rfc-editor.org/rfc/rfc9700) informs current redirect/PKCE/refresh security.

Historical sequencing: this increment shipped DCR and existing predefined clients first; the subsequent [published-identity profile](56-published-client-identities.md) now implements bounded CIMD and signed assertions. The DCR choices were to retain exact HTTPS callbacks and passkeys, persist client credentials without deployment rotation, disclose unverified labels, and keep backend packages independent from Studio/runtime. CIMD URL retrieval/SSRF protections, signed assertions and registration management are separate contracts, not silently accepted metadata.

## Evidence and remaining work

[Acceptance and reproducible checks](../research/results/mcp-registration/README.md) distinguish current software results from provider deployment and named-client tests. The existing live acceptance now bootstraps a dynamically registered confidential client through consent and PKCE, with no predefined client configuration, then exercises real browser edits/Undo, controls, cues and stop/replacement behavior through workerd/D1/Durable Objects.

Open: production deployment observations and actual ChatGPT/Claude/Groq/other-host pairing; broader published-identity/native-client coverage beyond [the implemented profile](56-published-client-identities.md); registration management/fleet policy; dedicated audience/MCP Apps hosts and narration/media orchestration; durable project storage and multi-user collaboration. Physical tests stay postponed; human usability/screen-reader sessions remain separate evidence.
