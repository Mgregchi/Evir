# @evir/service

Independent Cloudflare Worker/D1 service implementation, composed by `apps/web/worker.mjs`. The live bridge imports only shared tool metadata; Studio remains the source/Undo execution host. No persistent project storage. The account browser assets are copied into the single web build; account HTML is served by the Worker.

[Live pairing](../../docs/54-live-studio-pairing.md) adds a metadata-only D1 lease and a transient Durable Object relay.

[Account setup, security contracts, scope and remaining work](../../docs/53-cloudflare-accounts-and-mcp.md). Owner setup is entirely through Cloudflare's Git-connected dashboard. Production migrations run automatically before publishing and preserve dashboard variable/secret values. Do not run a production deployment from a developer test.

`npm run test:service` exercises real local workerd/D1 and Chromium's virtual authenticator. Build the web assets and install/select Playwright Chromium first. These are contributor checks, not instructions for the deployment owner. No physical-device or named-client pairing is asserted.

[Automatic MCP client registration and host setup](../../docs/55-mcp-client-registration.md) adds `/oauth/register`, D1 client metadata and public/Basic/POST client authentication. Existing dashboard-defined public clients stay compatible. Registered credentials persist across Git deployments; user grants still expire/rotate/revoke independently. No new owner variables or local Wrangler commands.
