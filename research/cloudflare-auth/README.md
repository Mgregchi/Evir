# Account and deployment research

Official documentation endpoints that returned 403 are recorded as unavailable and supply no evidence. The corresponding Cloudflare-maintained documentation source in `cloudflare/cloudflare-docs` was retrieved successfully. Source hashes and URLs are in `sources.json`. SimpleWebAuthn registration/authentication implementation source was also inspected; the installed runtime is pinned to 14.0.3, not implicitly to repository head.

Observed: Workers Builds supports a custom deploy script; D1 keeps an applied-migration ledger; `keep_vars` retains dashboard variables; normal Wrangler deploy retains existing secret bindings; selective Worker-first routes allow account APIs alongside static assets. MCP/OpenAI document authorization-code/PKCE authentication and predefined clients as an option.

Decisions: reuse one web Worker host with an independent service package; bind an explicitly chosen existing D1 UUID; fail deployment if migration fails; no checked-in runtime variable/secret defaults; passkey-created email-free accounts; predefined public OAuth clients and account:read only initially. No DCR, CIMD, client-secret authentication, project bridge, identity provider certification or named-client compatibility claim follows from these sources. Local virtual-authenticator/workerd results are recorded separately from research.
