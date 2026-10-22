# Live Studio evidence

[Acceptance and reproduction](acceptance.json), [browser checks](browser.json), actual Studio captures and [logs](logs/) cover the scoped live bridge. [Live wave source](live-wave.evir-project) was captured after MCP created a looping arm animation in the original Evir Explorer character. Audience bindings stay outside this source.

The test client is synthetic. HTTP/WebSocket traffic is routed to real local workerd/D1/Durable Object handlers; no scene operation is mocked. Playwright records browser WebSocket constructor arguments because its route API does not expose handshake headers. No named commercial client, live Cloudflare account, physical device or human session is asserted.

[Dashboard-only setup and live-session contracts](../../../docs/54-live-studio-pairing.md). No new frontend/runtime variables or local owner Wrangler commands.
