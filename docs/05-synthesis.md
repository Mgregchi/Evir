# Compatibility decision for Evir

This document describes the original research baseline. See [extended experiments](07-extended-experiments.md) for later weighted-deformation, interaction, rendering and official RML/CLI results.

## Decision

Continue with a deliberately small `.riv` compatibility slice while retaining Rive as the rendering and behavioral reference. Defer a new `.evir` format and a replacement GPU renderer. The independent exporter now creates files that official runtimes accept and execute, so the next useful extension can be tested against an existing oracle rather than guessed.

This is a research decision, not a claim that Evir already matches Rive's full engine. We have a structural codec and a semantic export subset, plus a reproducible official-runtime baseline. There is no independent Evir renderer to benchmark against Rive yet. Comparing Python structural parsing time against native/WASM full import time would not establish runtime parity and is intentionally avoided.

## Evidence supporting the decision

1. **Binary compatibility is achievable for a focused subset.** Eleven scenes built from schema records pass geometry and interaction checks under two official web packages, including articulated rigs and a 128-state selector.
2. **File size benefits come from concrete encoding and export choices.** The same static picture occupies 76 bytes with omitted defaults and 138 with explicit defaults. It renders identically. This tests our own export policy, not a claim that official editor exports are wasteful. Embedded assets in the upstream corpus change the size profile far more than a handful of compact keys.
3. **Renderer selection changes costs.** Canvas2D and WebGL2 have different initialization costs, memory behavior and feature support. The WebGL2 results use software SwiftShader, so a cloud result cannot select a mobile GPU strategy.
4. **RML already provides official text authoring.** Studied documentation and source fixtures make it a credible alternative to inventing an authoring syntax. An actual CLI export comparison remains to be run once the installer is accessible.
5. **Compatibility has real engineering cost.** Type inheritance, context-dependent record ordering, separate index spaces, unknown-property skip metadata and field-specific behavior all matter. Successful structural preservation is weaker than semantic support.

## What to adopt

Retain numeric type/property keys, compact references, default omission, immutable/shared file data where practical, per-instance playback state, dependency/dirt tracking, explicit import validation and renderer abstraction. These are supported by inspected source and experiments. Keep an inspectable authoring representation alongside generated binary artifacts so changes and benchmark inputs can be reviewed.

Before adopting a new wire format, specify the educational-character workload and measure a concrete benefit against equivalent content. A new format should improve a demonstrated problem—such as incremental loading or exporter determinism—without forcing a premature replacement of scene, animation and interaction semantics.

## Gates before claiming parity or designing the final format

| Gate                      | Current evidence                                                                     | Remaining experiment                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Independent binary export | Static, animation, bone and state-machine fixtures accepted                          | Add targeted tests for weighted skinning, curves, gradients and nested scenes                         |
| Interaction correctness   | Boolean/number state changes and N-state selectors                                   | Triggers, blend durations/trees, listener behavior and reset cases                                    |
| Compactness               | Byte counts, gzip sizes, embedded-asset attribution, same-content default experiment | Official CLI/editor export of the exact same scenes, equivalent fonts/images and compression settings |
| Load performance          | Separate Python codec and official package cold-page/warm-load measurements          | Instrument decode, import, reference resolution and asset decode independently                        |
| Rendering                 | Two web paths pass visual checks; cloud timing and memory recorded                   | Real GPU devices, larger scenes, overlap, curves, clipping and feathering                             |
| Mobile constraints        | No device evidence                                                                   | Physical low-end Android/iOS memory and frame-time profiles with explicit versions/resolution         |
| Independent engine parity | No independent renderer implemented                                                  | Equivalent Evir runtime, matching visual output, then controlled comparisons                          |

The research questions now have documented implementation answers and reproducible evidence for the selected slice. Full feature and performance parity remains a separate engineering claim requiring those additional workloads and devices. The measured results therefore justify extending compatibility before committing to a competing format; they do not justify claiming a production-ready Rive replacement.
