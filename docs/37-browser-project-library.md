# Browser project library and safe tab saves

Studio now retains separate browser project entries instead of replacing one recovery slot. **Project menu → Projects in this browser…** opens a searchable bottom sheet. Projects sort by latest save and display at most 20 rows per page. Open a row to return to its saved source. New and file imports retain the previous committed project before switching; imports receive independent browser entry keys even when their authored IDs match an existing scene.

The library belongs to this browser profile and website origin. It requires no account, backend, new environment variable or second deployment. Download **Save project** copies for portable backups. Clearing site data removes the library; page termination may interrupt an in-flight save. Source files and `.riv` exports contain scene data and retain their existing contracts. Browser entry keys, timestamps, save revisions and search/paging state are separate storage metadata.

## Two tabs and recovery

Opening another tab restores the last saved entry without writing an unchanged source. Saves compare the tab's expected revision against the stored revision and write source plus metadata in one IndexedDB transaction. A stale tab cannot overwrite a newer save. Same-origin BroadcastChannel messages provide early notice; transaction checks still enforce safety when the channel is unavailable.

When another tab saves this project, a persistent custom notice offers:

- **Open latest:** after confirmation, replace the current canvas with the saved version. Download a project copy first if you want to keep the open edits.
- **Save a separate copy:** retain the open edits as a new browser entry without replacing the other tab's version. Authored scene IDs and names remain unchanged; the browser key distinguishes the copies.

These are whole-project copies, not collaborative merging or revision history. Editing different browser entries does not conflict. Studio shows saved status after transaction completion; quota/access/transaction failures retain the open project and offer download recovery. Switching is stopped if the current committed edits cannot be retained. Drawing drafts must be finished or canceled first.

The database name stays `evir.studio.recovery.v1`; its schema upgrades to version 2. An existing IndexedDB `current` source moves atomically into a keyed entry. The old localStorage recovery copy is removed only after its replacement commits. Older tabs can block schema upgrades: close those tabs and reload/retry. Version-change notifications close this implementation's old database connection.

## Research and implementation choices

The [source record](../research/project-library/sources.json) includes fetched primary URLs, dates and response hashes. Rive's documented File Browser exposes recent files, search, organization and downloads. MDN documents schema upgrades, serialized overlapping read/write transactions and same-origin BroadcastChannel behavior. Evir chooses a small browser-local library with an explicit conflict copy workflow; cloud workspaces, account sharing and synchronized folders are not implemented here.

Source payloads live in the `projects` store. `library` holds only key, revision, name, last-save time and layer/artboard counts, indexed by update time. `state` tracks the last opened/saved entry. Searching walks metadata and returns one bounded page, rather than cloning every embedded image/font. A queued old save captures its original entry/revision and cannot change the active tab session after a project switch. During confirmed switching, Studio pauses preview playback, marks the workspace busy and temporarily suspends editing/command shortcuts while validating/preparing the next source. A small preparation notice respects reduced motion. The new save target is adopted only after assets are ready. Existing debounced, ordered writes remain in use.

## Try it with real examples

Use the existing original [Sprig](../apps/web/assets/examples/sprig.evir-project) and [Signal](../apps/web/assets/examples/signal.evir-project) studies: open Sprig, change its project name, then open Signal. Find Sprig in the browser project sheet and reopen it. Open a second Studio tab, rename the shared project in the first tab, and save the second tab's edits as a separate copy. Search the sheet to see both versions. These source/poster/runtime examples already demonstrate the scene features; this increment adds a workspace workflow rather than a new renderer feature.

[Browser evidence](../research/results/project-library/browser.json) and four-size screenshots cover search/reopen, New/import retention, original geometry, actual two-tab conflicts, both conflict actions, reload, metadata paging, aborted writes, legacy migration, quota rollback, delayed asset preparation and keyboard focus. The landscape run disables BroadcastChannel to exercise the fallback. The existing large-recovery workflow verifies a 1,000-node source and a 4 MiB embedded asset.

Reproduce with `npm run test:editor` and `npm run validate:editor`. For a focused iteration after `npm run web:build`, run `node tests/editor/library-browser.cjs`. These are automated Chromium/software checks, not physical-device, moderated-user or screen-reader evidence. Hosted backend, physical tests, rich feature parity/import and broader control virtualization remain separate work.
