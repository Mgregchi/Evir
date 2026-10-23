# Published client identity acceptance

[Guide 56](../../../docs/56-published-client-identities.md) defines the curated profile and owner setup. [The remaining-work register](../../../docs/57-remaining-work.md) is the current cross-project backlog. [Primary sources and public snapshots](../../cimd/) preserve retrieval provenance.

The service tests use synthetic publisher/key responses with all other network access disabled, ephemeral test keys and real local workerd/D1. They verify RS256/ES256, supported method intersections, one-use assertions under parallel exchange, expiry/identity/audience/header checks, code/PKCE/resource binding, rotating refresh, authenticated revocation, current callback/scope restrictions, unknown-key rotation, cache budgets/age, invalid/oversized/redirected documents, the three-second fetch deadline and no dynamic registration for a published identity.

[Browser acceptance](browser.json) uses the observed Claude Code metadata with a synthetic local callback, real service handlers and cloud Chromium. It checks a branded Retry page after a failed fetch, hostname-focused consent, explicit actual callback port, responsive layouts at 320/390/1440 pixels, zero automated WCAG A/AA violations, state/issuer/code handling and PKCE exchange. OAuth creates no Studio share. Captures: [Retry](retry-390.png), [320 consent](consent-320.png), [390 consent](consent-390.png), [desktop consent](consent-1440.png).

[Public-document observations](public-document.json) separately run the production loader in Node through the workspace proxy against actual public Claude Code/ChatGPT metadata and ChatGPT public keys. These are fetch/validation observations, not an end-to-end client connection or production Worker outbound-network test.

[Acceptance and hashes](acceptance.json) records the final local commands, versions and scope. Worker packaging uses a fake D1 ID and `--dry-run`; no remote migration/deployment occurs. Migration acceptance upgrades an existing local database and repeats the migration ledger while retaining account/client records. The owner continues to deploy from GitHub through Cloudflare with dashboard settings preserved; there are no new variables or secrets.

No actual ChatGPT/Claude/Claude Code/Groq pairing, production deployment, human/screen-reader session or physical-device result is claimed. Physical work remains postponed.

Final local acceptance passed: 28 distinct service cases (27-case full suite plus the added one-case ChatGPT snapshot check), 27 frontend cases, full build, Worker packaging dry-run, 22 site/configuration checks, 558 official-runtime showcase comparisons, all 32 gallery studies, motorcycle/character/Learn regressions and experience checks. [Logs](logs/) and copied reports preserve this run without overwriting older research evidence. GitHub checks on implementation commit `f1ac050` did not start because of the account billing lock; that is not a CI pass.
