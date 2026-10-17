# Native stroke evidence

Validated on 16 October 2026; application commit `77ac9c5c0dc0394b1021b8ac77e73e576d83963f`, based on main `087ed17`. [PR #35](https://github.com/Mgregchi/Evir/pull/35) adds the implementation and these records.

- [Validation ledger](validation.json): completed commands, source hashes, environment, initial failures and their corrections, reproduction and CI billing restriction.
- [Focused native comparisons](native.json): 74 selected comparisons against official Rive Canvas/WebGL2 2.44.0, including animation-free rest exports and animated paint/effects. Cloud Chromium uses software graphics.
- [Studio browser workflows](browser.json): five viewports, draft/error/focus/cancellation, history, recovery, downloads, editable binary import and retained freehand centerlines.
- [Gallery native comparisons](gallery-native.json): 472 selected comparisons across 25 original studies, with `.riv` hashes. [Gallery workflows](gallery-browser.json) include all 25 source open/export round trips.
- [Public pages](public-site.json) and [experience checks](experience-quality.json): page configuration, responsive automated accessibility, reduced motion and scheduling.

Local units passed: **30 runtime, 92 editor and 26 frontend**. Runtime builds, full editor/native-authoring gates, web and experience checks completed successfully. Regeneration left all 50 showcase source/export hashes unchanged. GitHub CI jobs did not start because the account was locked for billing; the ledger links the observed jobs. No physical-device, human/assistive-technology or complete renderer-parity claim follows from these checks.

Actual screenshots: [Trace in desktop Studio with editable points](studio-trace-1440.png), [narrow Studio](studio-trace-390.png), [phone stroke sheet](stroke-sheet-390.png), [landscape stroke sheet](stroke-sheet-844.png) and [retained centerline drawing](centerline-drawing-1440.png).

See the [workflow, contracts, limits and reproduction guide](../../../docs/41-native-strokes-and-path-effects.md). Native fixture source/export pairs beside these reports are generated test scenes, not private uploads or matched Rive Editor-authored benchmarks.
