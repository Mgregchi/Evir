# Cron-free maintenance acceptance

[The deployment guide](../../../docs/58-cron-free-maintenance.md) explains the quota error and the Git-connected remedy. [Sources](../../cloudflare-maintenance/sources.json) record the official documentation research.

The targeted tests use real local workerd/D1 and independent binding wrappers to exercise concurrent claims against the same database. Twelve competing callers produce one cleanup batch; live records, accounts, passkeys and recovery codes survive. Additional tests cover failed cleanup, short-lease retry, interrupted-worker recovery, warm-binding suppression, static traffic, real Worker service traffic and expiration rejection while an expired credential row still exists. The deploy acceptance verifies the generated configuration contains explicit `crons: []` while preserving dashboard variables.

[Validation](validation.json) records final results, commands, logs and source hashes. Background work is traffic-driven; an idle deployment does not promise deletion at a fixed time. No provider deployment, external account inventory, production quota change or physical-device test is claimed.
