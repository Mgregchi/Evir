# Cloudflare accounts and authenticated MCP

**Connector update:** [Automatic client registration](55-mcp-client-registration.md) now supports DCR and confidential-client authentication. Most hosted connections can register automatically without `OAUTH_CLIENTS`. Existing predefined clients remain available. [Published identities and signed assertions](56-published-client-identities.md) now add a curated ChatGPT/Claude profile without new dashboard settings.

**Live-session update:** [Live Studio pairing](54-live-studio-pairing.md) now adds explicit project sharing, scene scopes and a WebSocket bridge. The dashboard settings below stay the same; the next Git deployment provisions its namespace and D1 migration automatically.

22 October 2026. The owner selected Cloudflare Workers and D1, with deployment entirely through the GitHub-connected Cloudflare dashboard. No local Wrangler command is required from the owner.

## What this increment does

The existing `apps/web` Worker hosts the static website/Studio and delegates account/API requests to the independent `@evir/service` package. Engine packages do not import the service. The account page is `/account/`. The service-enabled Worker adds a Connections link to the home-page navigation and an account link in a new tab from Studio’s project menu; static-only hosts stay unchanged. Studio still works without an account and still keeps projects in the browser.

Accounts use discoverable, user-verified WebAuthn passkeys. First registration creates a random account ID without collecting email or a password. Evir stores credential public keys and counters, not biometric data. Synced passkeys are allowed; this is not a requirement for hardware-bound keys or an encryption scheme for artwork. The page supports another passkey, eight single-use recovery codes, connection revocation and sign-out. Recovery codes are shown once and stored as hashes. Using one revokes existing browser sessions and agent grants. Losing all passkeys and recovery codes currently loses access; there is no email or administrator recovery bypass.

OAuth uses authorization code + S256 PKCE, exact predefined HTTPS callbacks, a resource restricted to this origin's `/mcp`, explicit consent and opaque hashed tokens. Codes last two minutes, access tokens ten minutes, grants/rotating refresh tokens thirty days and browser sessions seven days. Security changes require a sign-in within five minutes. A daily scheduled job removes expired transient records and grants. D1 fixed-window request limits reduce repeated sign-in/recovery attempts; they are not a claim of global abuse protection.

## Dashboard setup — no local commands

Follow the **Cloudflare Workers** section in [Git-connected hosting](20-github-connected-hosting.md). The complete steps are:

1. **Storage & databases → D1 → Create database.** Name it `evir-accounts`. Copy its database UUID. Do not paste SQL into the console.
2. **Workers & Pages → evir → Settings → Builds.** Connect `Mgregchi/Evir`, production branch `main`, root directory `apps/web`.
3. Set **Build command** to `npm --prefix ../.. ci && npm --prefix ../.. run web:build`.
4. Set **Deploy command** to `npm --prefix ../.. run cloudflare:deploy`. This replaces a bare `wrangler deploy` command. Wrangler runs on Cloudflare, not on your computer.
5. In **Build variables and secrets**, set `NODE_VERSION=24`, `SKIP_DEPENDENCY_INSTALL=1`, and `D1_DATABASE_ID` to the copied UUID. Existing public website/link settings stay here.
6. In **Builds → API token**, select the build token and open **My Profile → API Tokens** to edit its permissions. Add **Account → D1 → Edit** for the intended account while retaining Worker deployment permissions. Cloudflare’s documented default generated build token does not include D1 edit access. Do this before the first account-service deployment.
7. In the Worker's **Settings → Variables and Secrets** (runtime), set `SITE_URL` only if your public origin differs from `https://evir.idey.click/`. Accounts require HTTPS at the root of a domain. Choose the final public hostname before creating passkeys: WebAuthn credentials are tied to that domain and do not automatically move to a new one. For a different domain, use the same `SITE_URL` in build settings for public SEO and runtime settings for authentication; these are two Cloudflare scopes of the same setting, not two URL concepts.
8. Disable non-production branch builds/previews for this production account service. The deployment script refuses non-`main` Workers Builds branches. Do not point a preview at production D1. Isolated preview accounts need a separately configured Worker, origin and D1 database; that automation is not included here.
9. Trigger the Git-connected production build after merging. Cloudflare runs migrations, then publishes the Worker and assets. It binds the selected database as `DB`; adding a second dashboard DB binding is unnecessary. Connect the public custom domain under **Domains**.
10. Open `https://evir.idey.click/account/`, create a passkey, then save recovery codes or add another passkey. Use your configured origin if different.

Cloudflare's Git integration supplies deployment authorization through its build token. The required D1 permission is configured in step 6; if the migration log reports authorization failure, edit the connected build token's permissions in Cloudflare and retry. No Cloudflare token belongs in the frontend's environment or repository. The owner does not need to run `wrangler login` or any migration command locally.

### Which setting goes where?

| Setting | Cloudflare location | Required? |
| --- | --- | --- |
| `NODE_VERSION=24`, `SKIP_DEPENDENCY_INSTALL=1` | Build variables | Yes, existing build setup |
| `D1_DATABASE_ID` | Build variables | Yes, existing database UUID |
| `SITE_URL` | Build variables and Worker runtime variables | Only for a different public origin; same value in both scopes |
| `OAUTH_CLIENTS` | Worker runtime variable, text containing JSON | Optional predefined clients; unnecessary for automatic registration |
| Community/social/feedback links | Build variables | Optional; existing frontend settings |

There is no `AUTH_URL`, `API_URL`, `RP_ID`, `JWT_SECRET`, frontend secret or separate editor URL. RP ID, issuer and MCP resource are derived from `SITE_URL`. Opaque tokens need no application signing secret.

### Dashboard variables and secrets survive deployment

The checked-in/generated configuration contains **no `vars` or secret values**. The deployment script also rejects repository `vars`/`env` overrides, so adding them later cannot silently replace dashboard runtime values. It sets `keep_vars: true`, and the deploy command also uses `--keep-vars`. Wrangler retains existing dashboard plaintext/JSON variables; existing Worker secrets are retained by its normal deployment behavior. The deployment script never invokes a secret upload/delete command, serializes runtime variable/secret values, seeds accounts or resets a database. Changing dashboard runtime variables/secrets does not require a Git commit. Build-time public settings need a rebuild because they are compiled into HTML.

The repository intentionally owns code, asset routing, the `DB` binding target and cleanup schedule. This does not promise to preserve arbitrary dashboard-only bindings or trigger edits; add new infrastructure to the deployment configuration deliberately. Changing `D1_DATABASE_ID` changes which existing database receives migrations and becomes `DB` on deployment.

### Automatic migrations

`tools/deploy-cloudflare.mjs` generates an ignored configuration using the explicitly supplied database UUID. It runs `wrangler d1 migrations apply DB --remote` before `wrangler deploy`. D1's migration ledger records applied filenames and only pending migrations run on later deployments. A failed migration stops publication. A later publication failure does not undo already applied migrations; retrying uses the ledger. Migration SQL must remain append-only and compatible with the previous Worker while deployment is in progress. No automatic destructive reset or down migration runs. Concurrent production deployments should not be triggered manually; use Cloudflare's build queue and inspect a failure before retrying.

## Connecting an MCP client

The MCP URL is `https://evir.idey.click/mcp`. The authorization-server and protected-resource metadata are available at `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource/mcp`.

Prefer [automatic registration](55-mcp-client-registration.md) for supported hosted clients. It needs no callback list or new dashboard setting. The following optional setup retains **predefined public OAuth clients** with PKCE. In the client platform's custom MCP connection settings, obtain its exact callback URL and configure a client ID that the platform can send. Then put this text JSON in the Worker's runtime `OAUTH_CLIENTS` variable:

```json
[
  {
    "client_id": "the-client-id-configured-in-your-agent-platform",
    "client_name": "Your agent connection",
    "redirect_uris": ["https://exact-callback-from-that-platform.example/callback"]
  }
]
```

Replace both placeholders with that platform's actual settings. Never use wildcard callbacks or copy an assumed ChatGPT/Claude callback from an example. No client secret is used: the client must support public-client `none` authentication with PKCE. Dynamic registration now supports `none`, `client_secret_post` and `client_secret_basic`; see the connector guide instead of adding those credentials to this predefined-public-client variable. [Published identities and signed client assertions](56-published-client-identities.md) are now advertised through a separate curated ChatGPT/Claude profile; the predefined-client setting above remains public-client only. Groq supports remote MCP with authentication headers; its host application must acquire and refresh Evir OAuth credentials. No named platform pairing has been observed in this workspace.

The client opens Evir's consent page. Users sign in with a passkey and choose **Allow connection** or **Cancel**. The first account increment exposed only `account:read` and `get_connection_status`. [The live-session increment](54-live-studio-pairing.md) now adds scene reading, editing and presentation scopes, separately granted project access from Studio, and the shared atomic command contract. Existing account-only tokens do not gain these permissions: reauthorize the connection when scene access is wanted. Signing in alone still does not share any project. Local stdio scene tools remain available.

## Evidence and boundaries

[Source retrievals](../research/cloudflare-auth/sources.json) distinguish blocked documentation pages from successfully retrieved official repository sources. [Acceptance](../research/results/cloudflare-auth/acceptance.json) and [browser evidence](../research/results/cloudflare-auth/browser.json) record workerd/D1, token/replay/ownership tests and a Chromium virtual authenticator. These are software tests, not real-device checks, human accessibility sessions, a live Cloudflare deployment or a named agent integration test. No cloud account was changed.
