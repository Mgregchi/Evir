# @evir/service

Independent Cloudflare Worker/D1 service implementation, composed by `apps/web/worker.mjs`. No engine or Studio project storage dependency. The account browser assets are copied into the single web build; account HTML is served by the Worker.

[Setup, security contracts, scope and remaining work](../../docs/53-cloudflare-accounts-and-mcp.md). Owner setup is entirely through Cloudflare's Git-connected dashboard. Production migrations run automatically before publishing and preserve dashboard variable/secret values. Do not run a production deployment from a developer test.

`npm run test:service` exercises real local workerd/D1 and Chromium's virtual authenticator. Build the web assets and install/select Playwright Chromium first. These are contributor checks, not instructions for the deployment owner. No physical-device or named-client pairing is asserted.
