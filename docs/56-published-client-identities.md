# Published client identities and signed assertions

23 October 2026. Extends [automatic registration](55-mcp-client-registration.md) without changing the single web host, passkey accounts, project-sharing permissions or dashboard configuration. This is a bounded client-identity profile, not general acceptance of arbitrary metadata URLs.

## Connecting

Use the deployed `/mcp` endpoint, normally `https://evir.idey.click/mcp`. ChatGPT's published-identity/CIMD mode and Claude's **Use Claude's published identity** can now use the profile below. **Register automatically** / DCR remains an alternative. A client must supply its real metadata identifier and callback; do not invent either. Availability and menus depend on the host. Groq still needs a forwarding application that obtains Evir OAuth credentials and supplies the access token.

Claude Code's public identifier is `https://claude.ai/oauth/claude-code-client-metadata`. Its document currently declares public-client authentication and `http://localhost/callback` / `http://127.0.0.1/callback`. For this exact identifier, Evir permits the requested native port while matching the declared hostname, path and query. The actual callback, including its port, is bound to the authorization code and must match exactly at exchange. This exception does not enable HTTP callbacks for arbitrary registrations or other published clients.

Sign in with a passkey, check the publisher and destination, and approve only a connection you started. Then open **Studio → Project menu → Live agent connection** and explicitly share a project. OAuth does not share artwork or grant general project access. See [live controls and delivery limits](54-live-studio-pairing.md).

No new variables or secrets are needed. The existing Git-connected Cloudflare deployment applies append-only migration `0004_oauth_assertions.sql` automatically before deploying. It preserves dashboard settings using the existing `keep_vars` configuration. The owner does not need local Wrangler or manual SQL. Existing predefined and dynamically registered clients retain their behavior.

## Supported identity profile

- Canonical HTTPS metadata URLs under `/oauth/` on exactly `chatgpt.com` or `claude.ai`. No other origins, subdomains, IP literals, explicit ports, query/fragment, user information, traversal or encoded paths. This curated trust boundary avoids arbitrary client-directed network access; it is not a general SSRF-safe URL resolver.
- Exact document `client_id`; a bounded plain name and 1–16 distinct callbacks. HTTPS callbacks match exactly. Only the exact Claude Code identifier above gets the declared literal-loopback exception. A document identifies its publisher, not the person or program making the request. Consent therefore emphasizes the hostname rather than treating the document's name as a verified caller.
- Authorization code + S256 PKCE and Evir's canonical `/mcp` resource remain mandatory. Omitted grants default to authorization code only; refresh requires an explicit `refresh_token` grant. Current published scopes and callback eligibility are checked at exchange; scope narrowing also prevents refresh of a broader grant. Previously issued access tokens retain their normal expiry/revocation policy.
- Public `none` authentication or `private_key_jwt`. If a plural authentication-method array is present, Evir uses its supported intersection; it takes precedence over the legacy singular field. Unsupported future asymmetric methods can coexist with supported methods. Shared-secret fields/methods are rejected for published identities. DCR still supports its existing public/Basic/POST methods; this does not add JWT key registration to DCR or dashboard clients.
- JWT clients provide either embedded public JWKS or a JWKS URI on the same allowed publisher origin and OAuth path. RS256 and ES256 are supported through pinned `jose` 6.2.13/WebCrypto. Public keys require distinct bounded key IDs; private/symmetric key material is rejected. Evir does not issue JWT access tokens or require an owner signing secret.

## Fetch and proof boundaries

Metadata and key requests forward no browser cookies or OAuth credentials. Each fetch has a three-second deadline, a 64 KiB body limit, JSON content validation, and requires status 200. Redirects are not followed. Client-supplied logos and other URLs are not fetched. Failures are not cached and produce a branded, accessible Retry page during authorization; APIs retain structured errors.

Validated metadata and key sets share a 32-entry per-isolate cache, with at most 16 in-flight fetches and request deduplication. TTL respects no-store/no-cache/private, max-age/Age and Expires, capped at five minutes, with a one-minute default. There is no stale-on-error fallback. An unknown key ID can refresh cached keys with a five-second guard; ordinary invalid signatures do not trigger forced refresh. Cache eviction/isolate replacement may require another public fetch.

Signed assertions require a key ID, supported algorithm, `iss = sub = client_id`, and audience equal to Evir's issuer or the exact called token/revocation endpoint. `iat`, `exp` and a bounded `jti` are required; lifetime is at most five minutes with 30 seconds of clock tolerance. Token-supplied key URLs/keys and critical headers are rejected. Mixed secret/assertion authentication rejects.

After signature/claim validation, D1 atomically records a hash of client ID + nonce until expiry plus clock tolerance. Parallel reuse permits at most one successful assertion. Invalid signatures do not consume a nonce; a valid assertion submitted with a bad authorization code does, so a retry needs a fresh assertion. Scheduled cleanup removes expired hashes. The normal code, PKCE, resource, grant and refresh checks still apply.

## Research and evidence

[Retrieval outcomes and hashes](../research/cimd/sources.json) cover OpenAI and Claude authentication guidance, MCP authorization, the live CIMD draft, RFCs 7523/8725 and JOSE. The draft is evolving; this implementation advertises the existing MCP protocol versions, not a new protocol or universal draft conformance.

OpenAI documents plural authentication methods and its preferred CIMD flow, including callback-specific metadata identifiers. The generic `https://chatgpt.com/oauth/client.json` and `/oauth/jwks.json` returned valid JSON with HTTP 200 on 23 October. The current [public metadata](../research/cimd/chatgpt-metadata.json) advertises both public and signed authentication and a same-origin JWKS. Availability is an observation at retrieval time, not a pairing result. No guessed callback was hardcoded.

The public ChatGPT metadata/keys and [Claude Code document](../research/cimd/claude-code-metadata.json) were fetched and accepted through the production loader in Node using the workspace proxy. This establishes public-document acceptance only. Tests use a copy of that document and synthetic publisher/key responses against real local workerd, D1 and browser flows. They exercise consent, Retry, native callback binding, RS256/ES256, replay, refresh, revocation, key rotation, cache limits and failure recovery. [Acceptance evidence](../research/results/cimd/README.md) records the commands and limits.

Still unobserved: actual named-host OAuth pairing and provider deployment, key/metadata behavior during real host updates, and production operational behavior. Additional publishers, algorithms, registration management and host-specific scope step-up require their own contracts. See the [complete remaining-work register](57-remaining-work.md). Physical tests remain postponed.
