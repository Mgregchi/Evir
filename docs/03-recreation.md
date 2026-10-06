# Independent `.riv` creation and acceptance

## Implemented capability

`tools/riv.py` implements a standard-library Python structural reader and writer. It decodes headers, properties and records through a pinned inherited schema, reports offsets and preserves known and ToC-typed unknown fields. `tools/generate_fixtures.py` constructs scenes with explicit import contexts and index references. It never copies the scene records of an editor-exported file to make the generated fixtures pass.

The executable acceptance criterion is stronger than 'the runtime did not throw': the official runtime must draw the expected geometry, move it at known sampled times, and respond to input changes. The same checks run using Canvas2D and the Rive Renderer through WebGL2.

| Fixture                    | Authored behavior                                                    | Browser assertions                                                  |
| -------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `static`                   | Blue 48×48 rectangle centered at (64,128)                            | 2,304 visible pixels; expected centroid                             |
| `static-explicit-defaults` | Identical content with additional default-valued fields              | Exact static pixel hash matches compact fixture within each backend |
| `animated`                 | X moves 64 → 192 → 64 over a one-second looping timeline             | Sampled start/midpoint centroids match, pixel hashes change         |
| `bones`                    | Two rigid limbs parented to root/child bones; two rotation timelines | Both timelines load; sampled geometry changes                       |
| `state-machine`            | Boolean `active` selects Idle/Active poses                           | Visible X position changes 64 → 192 → 64 when input toggles         |
| `stress-100`               | 100 rectangles with independent rotation timelines                   | Scene renders; benchmark starts all 100 timelines                   |
| `states-2/8/32/128`        | Number `target` selects one of N poses through any-state conditions  | Target 0, last and midpoint render at the expected X positions      |
| `characters-25`            | 25 two-bone rigs, 50 visible limbs, Idle/Dance controller            | Visible geometry changes when `active` enables Dance                |

The state-selector benchmark changes its input on every animation frame. Merely loading a large but idle state graph would not test the same condition-evaluation and transition path. The generated character scene exercises transforms and rigid attachments; it is not a proxy for a complex skinned production character.

## Tests and results

The standard-library suite has 16 tests. They cover independent golden bytes, LEB128 boundaries and overflow, ZigZag integers, scalar byte representations, truncation, invalid UTF-8, header rejection, unknown properties with and without ToC metadata, ToC word boundaries, property edits and schema mismatch, and all generated/upstream round trips. The upstream corpus checks its provenance hashes as well as byte identity.

Browser validation covers 11 generated fixtures per backend. It checks input names, animation/machine discovery, pixels, motion and interaction rather than only a port, PID or successful import. Browser JavaScript errors fail the run. WebGL2 pixels are captured from the composited canvas as transparent PNGs; Canvas2D uses `getImageData`. Direct Canvas2D reads from a WebGL canvas are invalid, so the capture paths are separate. Each backend's static hash comparison is internal to that backend; cross-backend antialiasing identity is not assumed.

Raw outcomes are in `research/results/runtime-validation-canvas.json` and `runtime-validation-webgl2.json`. [The workflow](../research/README.md) reruns generation, tests, both browser validations and benchmarks. Generated JSON documents are readable authoring data; generated `.riv` binaries are retained as inspectable artifacts.

## Boundaries

The reader knows a wider structural schema than the exporter has semantically tested. Generated cases cover rectangles, solid fills, root/child bones, linear interpolation, looping timelines, boolean/number inputs and simple transition graphs. They do not establish full Rive compatibility, a complete RML compiler, a `.rev` editor, weighted-mesh export, listeners/data binding, text shaping, gradients, nested artboards, scripts, GPU-only features or animation-reset behavior.

Upstream files exercise additional record types for structural preservation. They are not presented as generated Evir output. Acceptance is verified on the official web packages; no Flutter, Android or Apple device run was performed. The installed Rive CLI could provide a separate RML-to-binary reference exporter, but its installer was unavailable through the current proxy. The research does not depend on that optional tool.
