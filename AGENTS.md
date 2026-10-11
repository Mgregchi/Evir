# Working on Evir

Read CONTRIBUTING.md and the current remaining-work table in docs/25-studio-navigation-and-remaining-work.md. Research primary sources before planning a new feature; keep observed behavior, product choices and outstanding evidence distinct.

For each new increment, fetch origin/main and start a fresh branch from it. Check the branch's PR state before continuing existing work. Never add commits to a branch whose PR is merged or closed. On completion, push and create a new PR targeting main; verify its state is OPEN and its head matches the pushed commit. Report that PR with portable GitHub links to tracked evidence. Do not merge or deploy unless requested.

Keep apps/web as the single host, importing the independently maintained Studio at /editor/studio/. Keep editor preferences out of runtime exports. Preserve supplied brand artwork. Prefer bottom sheets and drawers, custom feedback, and reduced-motion support. Do not invent physical-device, screen-reader, user-study or platform-parity evidence.
