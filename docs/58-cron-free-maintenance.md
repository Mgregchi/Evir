# Cloudflare deployment without cron slots

24 October 2026. Addresses deployment error `10072`: Cloudflare could upload the Worker but could not finish updating its schedules because the account's free Cron Trigger quota was full. Successful deployment changes are not necessarily rolled back when trigger configuration fails.

## What Evir needs

Previously Evir declared **one** cron, `17 3 * * *`. That one job already batched deletion of expired account sessions, passkey challenges, OAuth codes/tokens/grants, rate-limit windows and live-share metadata. The reported **five-trigger limit is account-wide**, not five jobs declared by this project. We have not inspected the account's other Workers or dashboard schedules.

Evir now declares **zero cron triggers**. The repository retains explicit `triggers.crons: []`, because Cloudflare documents that an empty array removes this Worker's previously deployed schedules; omitting the property would leave them in place. This leaves other Workers' schedules outside the change.

## Deploy through GitHub

Merge the fix into `main` and let the existing Git-connected Cloudflare build run, or retry that build after the merge. No local Wrangler, plan upgrade for Evir's cron, new variable, secret, database migration or manual SQL is required. Existing dashboard variables/secrets, D1 binding and automatic migration/deploy steps stay unchanged. Schedule updates may take several minutes to propagate globally.

This fix is based directly on main and is independent of the pending connector PRs. After those merge, their extra expired-record cleanup remains part of the same shared cleanup function; no additional scheduler is introduced.

## How cleanup runs

Only account/API/OAuth/MCP requests enqueue housekeeping with `ctx.waitUntil()`. Static website/Studio assets do not start it. The response does not await the database cleanup. There is no polling timer or new maintenance endpoint.

A reserved `maintenance:expired-records:v1` row reuses the existing `rate_limits` table's identifier/count/expiry shape. Its count is zero; normal rate-limit IDs are hashed, so they cannot collide with this colon-containing identifier. An atomic conditional insert/update claims a five-minute lease across Worker instances. The winner runs the existing cleanup batch and extends the lease for 24 hours after success. Other instances skip deletion. A warm instance remembers the lease and avoids repeat D1 checks during that interval.

A failure/interruption leaves the short lease rather than claiming a full day's success. Later service traffic can retry after five minutes. `waitUntil` failures remain visible in Worker error logs. Cloudflare limits HTTP background work to 30 seconds after response completion/disconnection; this remains small opportunistic housekeeping, not a durable job queue or guaranteed wall-clock daily task.

If there is no service traffic, expired rows remain until a later request triggers cleanup. Authentication, OAuth, rate limits and live-share checks enforce their own expiration immediately; row retention does not extend access. Accounts, passkeys and recovery codes are not deleted. Existing per-share Durable Object expiry alarms remain and do not consume Cron Trigger slots.

## Research and acceptance

The [source ledger](../research/cloudflare-maintenance/sources.json) records retrievals from Cloudflare's official documentation repository after the documentation website rejected workspace requests. The [cron guide](https://developers.cloudflare.com/workers/configuration/cron-triggers/#remove-a-cron-trigger) explicitly distinguishes an empty cron array from an omitted setting. [Limits](https://developers.cloudflare.com/workers/platform/limits/) states that the free cron quota is per account; [context](https://developers.cloudflare.com/workers/runtime-apis/context/#waituntil) defines background execution and its deadline.

[Acceptance evidence](../research/results/cloudflare-maintenance/README.md) covers real local D1 concurrency, preserved live/security data, failure/interruption recovery, static-versus-service traffic, independent expiration rejection, generated deployment configuration and existing account/live flows. No production schedule was changed from the workspace; the actual Cloudflare redeployment remains an owner-observed result.
