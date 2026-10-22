# Live Studio evidence

[Acceptance and reproduction](acceptance.json), [browser checks](browser.json), actual Studio captures and [logs](logs/) cover the scoped live bridge. [Live wave source](live-wave.evir-project) was captured after MCP created a looping arm animation in the original Evir Explorer character. Audience bindings stay outside this source.

The test client is synthetic. HTTP/WebSocket traffic is routed to real local workerd/D1/Durable Object handlers; no scene operation is mocked. Playwright records browser WebSocket constructor arguments because its route API does not expose handshake headers. No named commercial client, live Cloudflare account, physical device or human session is asserted.

[Dashboard-only setup and live-session contracts](../../../docs/54-live-studio-pairing.md). No new frontend/runtime variables or local owner Wrangler commands.

Final local checks passed: 220 combined editor/runtime/frontend units, six independent package builds, all 30 Studio browser workflows, the complete native export suite, all 12 final service tests, public-site/showcase regressions, experience checks, the updated MCP guide and a deployment dry-run. Counts overlap where noted in acceptance; no aggregate test total is implied. The final guide check also verifies opening the hosted pairing sheet and explaining a missing service on static hosting. [Mobile guide capture](mcp-setup-390.png).

The broad Studio build preceded the last guidance, pairing-sheet and cue refinements; the rebuilt final-source live browser/service, guide and experience checks cover those affected flows. No rendering or model implementation changed afterward. Earlier targeted logs are retained with their distinct names; `service-final` is the final full service run. GitHub jobs on the implementation head were blocked before execution by an account billing lock.
