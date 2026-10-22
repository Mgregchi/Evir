# Software closure evidence

These are cloud Chromium/software-rendering results. They establish the listed fixtures and workflows, with fixture hashes and runtime versions recorded in the reports. They do not establish mobile/GPU performance, human usability or full Rive parity.

- [Acceptance and reproduction](acceptance.json) records the completed checks and any observed failures/retries.
- [Native pixels](compounds/native.json) compare generated/exported scenes with official Canvas and WebGL2. [Raw IK matrices](compounds/ik-poses.json) independently check bone poses.
- Responsive tasks: [compound paths](compounds/browser.json), [live shapes](live-shapes/browser.json), [stroke paints](stroke-paints/browser.json), [longer IK](ik-chains/browser.json), and [weight tools](skin-tools/browser.json). Their folders include actual screenshots and Studio-downloaded source/native files.
- [Pixel transfer sample](pixel-transfer/browser.json) verifies every image byte and records one cloud measurement of validation transport overhead; it is not an engine benchmark.
- [Site integration](site/) and [validation logs](validation/) preserve the final checks, including observed timing failures and retries.
- [Recovery regression](recovery/regression.json) records the deterministic failure before the automatic-fit fix and the successful two-tab checks afterward.

[Current contracts and remaining work](../../../docs/47-software-closure.md) distinguish these implementations from outstanding software and evidence. [Primary-source retrievals](../../software-closure/sources.json) record URLs, dates, response outcomes and hashes.
