# Runtime and format research: closure audit

The software experiments now cover the remaining targeted runtime/format topics. **The overall research is still open** because equivalent web Editor exports and physical GPU/mobile measurements are missing. `npm run check:closed` refuses to report completion until those inputs are present and pass the prepared checks. This audit precedes editor research and does not replace the missing evidence with a new scope definition.

## What the final software pass adds

### Weighted image meshes

The independent export embeds an original 64×64 four-color PNG. A nine-vertex image mesh has eight contour vertices, one interior vertex and eight explicitly indexed triangles. Four bones deform it with fixed, two-influence and four-influence vertices. Weights occupy four one-byte slots, indices are one-based into tendons, and the quantized weights sum to 255. The center uses all four slots: 64,64,64,63.

The test checks the undeformed 128×128 textured quad, deformed area/centroid, unmoving and moving exterior points, interior texture colors around the four-influence vertex, and bottom-edge deformation. At the tested peak, the expected polygon area is approximately 19,456 pixels²; nonzero pixel coverage differs slightly at sampled edges. The independent and official RML exports match pixel hashes at both poses within each backend. The plain mesh also checks all four texture quadrants, separating UV/image decoding from skinning. A further weighted case rotates a corner bone 45 degrees around a nonzero (128,128) bind origin; its coverage and centroid are checked against an independently calculated weighted polygon. This exercises inverse-bind translation and rotation rather than only identity-bind translations.

`tools/mesh_math.py` validates arbitrary supplied triangle lists against a 16-bit vertex-index limit and packs/normalizes one to four influences. Unit tests cover indices beyond a single varuint byte, invalid topology, duplicate/out-of-range bones, zero/nonfinite/negative weights, and quantization error across 100 deterministic samples. This is an export helper, not automatic image meshing or a general triangulator. The malformed-index fixture remains structurally readable by the codec but is rejected by both official runtimes; structural decoding and semantic acceptance are explicitly different checks.

The independently written mesh is 949 bytes and the CLI export 996 bytes. These exports render the same tested poses but are not identical authoring documents: the CLI project also includes a default four-layer machine and layout/skip metadata. The size difference is not evidence of universal exporter superiority.

### State machines, listeners and reset behavior

The final pass tests:

- A 400ms transition at deterministic 100ms steps, with positions 64,96,128,160,192.
- An exit-time gate at 500ms, independently of transition duration.
- A disabled transition that stays in its source state.
- Boolean AND numeric conditions, including the threshold boundary (50 does not satisfy greater-than50; 51 does).
- Pointer-enter/exit actions writing a boolean and returning the pose.
- Pointer-click writing a numeric input.
- Leaving and re-entering a once-playing animation: it restarts at the beginning in both the default case and the case carrying the generic reset bit. This does not establish that the bit controls re-entry; the observed re-entry reset occurs in both cases.

These extend the earlier trigger consumption, intermediate 1D blend, sequential direct blend, simultaneous layers, pointer-trigger action and host-instance reset checks. State advances in the deterministic cases use the pinned package's private research wrapper; production applications should use the supported host APIs. We do not claim exhaustive testing of random transitions, every early-exit/interruption combination, all input devices, event/listener types, or scripted conditions.

### Typed data binding and official authoring

Both independent and official RML scenes bind a number to horizontal position, another number to rectangle width, a color to the fill, and a boolean to state-machine transitions. Host writes produce the expected geometry and color; a pointer listener writes back to the model through a reverse bind; a fresh default instance restores defaults. The pixel hashes match between authoring routes in the initial, changed, returned and fresh-instance states, on both renderers.

The independently written data-bound scene is 456 bytes; the official export is 547 bytes. The schema extractor previously skipped multiline class declarations, including the property comparator used by the model-driven transition. Its declaration matching is corrected and metadata is regenerated from the same pinned source: 356 types and 656 properties. Only static property-key declarations are extracted, preventing instance fields from becoming bogus key definitions.

Six RML projects now verify, inspect with empty problem lists, and compile in fresh directories: static, feather, winding, direct blend, weighted image mesh, and data binding. Sources, the original PNG asset, export sizes and SHA-256 hashes are retained. Local compilation remains account-free; no scene was uploaded or published. Typed strings, enums, lists, nested component contexts, converters, scripts and every binding type remain outside the tested export subset.

### Complex feathered paints and paths

WebGL2 checks a feathered cubic curve, a clockwise compound path with an opposite-winding hole, a feathered linear gradient, and a feathered round-capped/joined stroke. Assertions distinguish opaque or high-coverage paint, fractional soft edges, transparent hole/exterior regions, and gradient color direction. Canvas2D cases are explicitly unrun because it does not support vector feathering; they are not reported as passes.

Together with the previous outer/inner/offset/clipped rectangle probes, this closes the previously failing feather-path investigation for the declared cases. It does not reproduce Rive's feather algorithm in an independent renderer, prove universal path support, or establish physical-device quality/performance. The independent triangle lab remains a simple-polygon experiment; it does not acquire holes or feathering merely because the official runtime accepts these new fixtures.

## Validation and measurements

`npm run research:all` runs the original workflow, advanced and complex experiments, this final software pass, its additional benchmarks, and the closure audit. Current evidence includes:

| Check                                             | Outcome                                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Python codec and mesh-export unit tests           | 22 passed                                                                                        |
| Geometry assertions                               | Passed                                                                                           |
| Positive runtime cases across all passes/backends | 98 passed                                                                                        |
| Malformed image-mesh index                        | Rejected by both official runtimes, recorded separately                                          |
| Complex feather scenes on Canvas2D                | 4 explicitly unrun                                                                               |
| Earlier feather diagnostic                        | 12 soft-edge and 2 zero-strength checks passed; 4 invalid-rule controls confirmed renderer skips |
| Original upstream/generated/CLI binary corpus     | 66 structural lossless round trips                                                               |
| Official local CLI source projects                | 6 verified/inspected/compiled                                                                    |
| Remote browser transport                          | Local CDP smoke passed; owner browser remained usable                                            |
| Physical-device and Editor comparisons            | Open; external prerequisites absent                                                              |

The added cloud benchmarks cover weighted meshes, live data binding and timed transitions, using three fresh-page and twelve warm loads and two-second frame observations per scenario/backend. They retain file size, scheduler cadence, callback CPU duration, JS heap, available WASM capacity and local renderer RSS. Dynamic model/input writes run during the observation; pose changes are also checked. See [Canvas measurements](../research/results/closure-benchmark-canvas.json) and [WebGL2 measurements](../research/results/closure-benchmark-webgl2.json) for actual results.

These are SwiftShader measurements. Near-60Hz scheduler cadence is not proof of hardware throughput or mobile smoothness. Callback CPU durations exclude asynchronous GPU completion, and loader latency includes runtime/resource work rather than only byte parsing. Timing fields are quantized; small-file loading differences must not be attributed solely to format byte counts. JS heap, WASM capacity and RSS overlap and must not be summed. The tested file format and renderer are coupled in the official runtime, so these observations do not identify a percentage of Rive's speed attributable to each.

## The two external items that remain open

**Physical desktop GPU and mobile measurements:** the workspace has no `/dev/dri` or USB device tree, no ADB installation and a SwiftShader runtime context. The hardware guard rejects software or unidentified contexts before measuring. A documented Android CDP runner now connects to an actual device rather than using device emulation; its transport has only been tested locally here. Run three trials on a hardware desktop and three on a physical Android device, with device/browser/driver/power/display provenance. [The exact protocol](../research/device-measurements/README.md) includes commands and output naming. iOS, native GPU memory and GPU completion remain unmeasured and must be scoped separately.

**Equivalent web Editor exports:** the public Editor URL is reachable, but the CLI authentication check fails and no authenticated Editor session/export files are available. Four matched-scene specifications and a six-pose pixel comparison are prepared. [The comparison instructions](../research/editor-comparison/README.md) define filenames, names/API contracts, provenance and error bounds. The checker refuses missing files/provenance and never substitutes CLI artifacts. No account modification or publication was attempted.

Neither absence is a test failure that can be fixed by relabelling software results. These items require actual outside resources. The machine-readable [closure report](../research/results/research-closure.json) keeps them open and records accepted evidence when it arrives. `npm run report:closure` writes the audit; `npm run check:closed` exits1 while either item is unresolved.

## Decision for the next phase

The evidence supports a schema-driven compatible export subset with explicit constraints, an authoring model separated from serialization, and an official runtime used as the semantic/rendering oracle. It supports researching the editor's authoring workflows once the two external checks are resolved. It does not justify committing to a replacement renderer, full Rive parity, or a new binary format merely to save tens of bytes in small scenes.

The editor can eventually target an Evir scene/animation/state-machine model and export the tested `.riv` subset through this writer. RML is a useful reproducible interchange and official comparison path; it is not itself proof of a complete authoring editor. Preserve an independent Evir model so future format choices do not become editor UI constraints. A native `.evir` design should follow measured requirements and hardware observations rather than precede them.

Sources remain the pinned runtime `7aa93402a27c800db8a36acc8672612c100ea9b1`, pinned documentation `8879acbbefbf676c8d68d66c2ddfe56c6ee50914`, CLI1.4.0 and web packages2.44.0. Relevant implementation paths are `src/shapes/mesh.cpp`, `src/bones/skin.cpp`, `src/animation/state_transition.cpp`, `src/animation/transition_number_condition.cpp`, `src/data_bind`, and the renderer/feather references linked in the previous pass. Evidence is reproducible, but support claims remain bounded by the actual cases.
