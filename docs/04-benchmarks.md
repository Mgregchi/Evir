# Benchmark results and practical limits

These measurements exercise independently generated `.riv` files with official Rive runtimes. They establish an export-compatibility and performance baseline. There is no independent Evir renderer here, so these results do not establish an Evir-versus-Rive speedup or full engine parity. The Python codec is measured separately because it performs structural parsing, not complete runtime import.

This report covers the original baseline. See [extended experiments](07-extended-experiments.md) for subsequent semantic probes, official RML exports and the independent triangle lab.

## Environment and method

Python 3.12.14; Node v24.19.0; Chromium 151.0.7922.173; Playwright 1.63.0. Both official web packages are pinned at 2.44.0. The canvas is 256×256 on headless Linux x64.

Graphics implementation: `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`. This is software rendering, not a physical GPU. No mobile device was measured.

- Codec: three warmups, 25 sequential samples per file using `perf_counter_ns`; median and nearest-rank p95. A separate tracemalloc pass measures Python peak traced allocations.
- Official loading: three fresh-page loads and 12 warm loads per fixture. Fresh-page time includes runtime/WASM initialization, HTTP fetch, decoding and import; HTTP/browser caches may be warm. Warm time reuses the runtime module but constructs a new playback instance. Small-file fetch overhead is included, so the result is not pure parser speed.
- Playback: a two-second observation after 250 ms warmup. Animation discovery and motion are checked. `stress-100` runs all 100 timelines; `characters-25` enables its Dance controller. N-state selectors change target every rAF.
- Frame metrics: rAF cadence measures scheduling. Runtime callback CPU time comes from the pinned package’s rolling one-second internal `durations` array and includes scene advancement, draw submission/flush or draw skipping. It excludes asynchronous GPU completion. The internal probe is version-sensitive and fails rather than substituting a different metric if it is absent.
- Memory: JavaScript used heap, WASM linear-memory capacity and renderer-process RSS are distinct observations. They overlap and must not be added together. RSS includes shared pages and browser state, including renderer processes retained after fresh-page trials. WASM capacity is allocated capacity, not live scene memory. Sequential warm runs share a module, so memory is not a clean per-fixture allocation delta.
- Sample sizes are descriptive; they do not support confidence intervals or broad device-performance claims. Browser callback timing has finite resolution, and reported zero-duration callbacks are timer quantization rather than zero-cost work.

## File size and binary efficiency

| Fixture | Bytes | Objects | Bytes/object | gzip bytes | Embedded asset bytes |
|---|---:|---:|---:|---:|---:|
| animated | 133 | 12 | 11.08 | 131 | 0 |
| bones | 286 | 24 | 11.92 | 223 | 0 |
| characters-25 | 7,776 | 767 | 10.14 | 1,389 | 0 |
| state-machine | 261 | 29 | 9.00 | 209 | 0 |
| states-128 | 9,109 | 1,037 | 8.78 | 2,359 | 0 |
| states-2 | 264 | 29 | 9.10 | 209 | 0 |
| states-32 | 2,357 | 269 | 8.76 | 750 | 0 |
| states-8 | 678 | 77 | 8.81 | 327 | 0 |
| static-explicit-defaults | 138 | 6 | 23.00 | 120 | 0 |
| static | 76 | 6 | 12.67 | 88 | 0 |
| stress-100 | 10,872 | 1,015 | 10.71 | 1,792 | 0 |
| animation_reset_cases | 2,105 | 265 | 7.94 | 948 | 0 |
| artboardclipping | 195 | 13 | 15.00 | 127 | 0 |
| library_with_text_and_image | 903,438 | 23 | 39279.91 | 515,689 | 903,055 |
| state_machine_transition | 1,415 | 85 | 16.65 | 1,088 | 0 |
| two_bone_ik | 313 | 24 | 13.04 | 288 | 0 |

The compact static export is 76 bytes; the same scene with explicitly serialized defaults is 138 bytes. Both produce the same pixels within each renderer. Omitting these defaults reduces this particular export by 44.9%. This compares two policies of our own writer; no official editor-export superiority claim follows. gzip can add overhead to tiny files, while larger typed streams compress well. Embedded assets change bytes/object dramatically, so that ratio is not an intrinsic measure of animation-engine quality.

## Official load and playback measurements

| Backend | Fixture | Fresh-page median ms | Warm median / p95 ms | Callback CPU median / p95 ms | rAF Hz |
|---|---|---:|---:|---:|---:|
| canvas | static | 62.600 | 2.850 / 54.300 | 0.100 / 0.100 | 60.00 |
| canvas | static-explicit-defaults | 53.900 | 1.900 / 4.500 | 0.000 / 0.100 | 60.00 |
| canvas | animated | 54.900 | 2.550 / 7.300 | 0.100 / 0.200 | 60.00 |
| canvas | bones | 55.000 | 2.300 / 4.800 | 0.200 / 0.300 | 60.00 |
| canvas | state-machine | 58.900 | 2.600 / 5.300 | 0.100 / 0.200 | 60.00 |
| canvas | characters-25 | 72.500 | 4.750 / 8.700 | 0.300 / 0.500 | 60.00 |
| canvas | stress-100 | 75.700 | 6.500 / 10.600 | 0.400 / 0.500 | 60.00 |
| canvas | states-2 | 54.400 | 2.050 / 5.400 | 0.200 / 0.300 | 60.00 |
| canvas | states-8 | 64.500 | 2.200 / 4.000 | 0.100 / 0.200 | 60.00 |
| canvas | states-32 | 68.900 | 2.500 / 4.000 | 0.100 / 0.200 | 60.00 |
| canvas | states-128 | 69.500 | 2.300 / 4.300 | 0.100 / 0.200 | 60.00 |
| webgl2 | static | 140.400 | 45.500 / 138.500 | 0.100 / 0.200 | 60.00 |
| webgl2 | static-explicit-defaults | 139.800 | 43.350 / 61.300 | 0.000 / 0.100 | 60.00 |
| webgl2 | animated | 133.700 | 45.150 / 52.600 | 0.300 / 0.600 | 60.00 |
| webgl2 | bones | 183.300 | 43.350 / 53.600 | 0.300 / 0.500 | 60.00 |
| webgl2 | state-machine | 179.100 | 44.650 / 51.900 | 0.100 / 0.200 | 60.00 |
| webgl2 | characters-25 | 148.100 | 46.300 / 62.700 | 0.300 / 0.400 | 60.00 |
| webgl2 | stress-100 | 202.100 | 44.200 / 52.400 | 0.500 / 0.700 | 60.00 |
| webgl2 | states-2 | 233.600 | 42.000 / 47.400 | 0.300 / 0.500 | 60.00 |
| webgl2 | states-8 | 148.000 | 47.250 / 49.700 | 0.200 / 0.400 | 60.00 |
| webgl2 | states-32 | 139.400 | 42.400 / 65.100 | 0.200 / 0.300 | 60.00 |
| webgl2 | states-128 | 147.800 | 43.700 / 48.000 | 0.300 / 1.000 | 60.00 |

The observed ~60 Hz cadence is consistent with this browser’s frame scheduler; it does not establish maximum throughput or mobile 60 FPS. A static scene or settled controller can skip actual drawing while callbacks continue. Our checks establish that the animated workloads visibly change, but GPU-completion latency is not measured. Software WebGL2 initialization and shader/renderer state can dominate warm loads for these small scenes. A different backend or hardware GPU can reverse that comparison.

## Memory observations

| Backend | Fixture | JS used heap MiB | WASM capacity MiB |
|---|---|---:|---:|
| canvas | static | 3.19 | 16.56 |
| canvas | characters-25 | 3.46 | 16.56 |
| canvas | stress-100 | 3.85 | 16.56 |
| canvas | states-128 | 3.40 | 16.56 |
| webgl2 | static | 4.33 | 16.62 |
| webgl2 | characters-25 | 4.82 | 16.62 |
| webgl2 | stress-100 | 5.17 | 16.62 |
| webgl2 | states-128 | 5.04 | 16.62 |

Per-process RSS snapshots and timing spreads are retained in the raw runtime JSON. These are cloud-browser observations, not mobile memory budgets or isolated file memory requirements. The browser/renderer/runtime baseline can dwarf a 76-byte scene.

## Independent Python codec

| Fixture | Parse median / p95 ms | Preserve-write median ms | Peak traced parse allocation KiB |
|---|---:|---:|---:|
| animated | 0.042 / 0.044 | 0.019 | 7.9 |
| bones | 0.093 / 0.226 | 0.039 | 17.9 |
| characters-25 | 3.072 / 3.601 | 1.175 | 924.7 |
| state-machine | 0.091 / 0.355 | 0.039 | 14.9 |
| states-128 | 3.835 / 4.316 | 1.497 | 1154.0 |
| states-2 | 0.090 / 0.102 | 0.038 | 15.0 |
| states-32 | 0.983 / 1.202 | 0.368 | 277.7 |
| states-8 | 0.264 / 0.382 | 0.103 | 60.5 |
| static-explicit-defaults | 0.034 / 0.058 | 0.017 | 7.3 |
| static | 0.021 / 0.024 | 0.010 | 3.9 |
| stress-100 | 4.270 / 4.771 | 1.693 | 1289.1 |
| animation_reset_cases | 0.791 / 0.879 | 0.305 | 218.6 |
| artboardclipping | 0.048 / 0.066 | 0.022 | 9.3 |
| library_with_text_and_image | 1.799 / 2.273 | 1.326 | 3939.0 |
| state_machine_transition | 0.397 / 0.484 | 0.169 | 113.8 |
| two_bone_ik | 0.094 / 0.108 | 0.042 | 18.1 |

The reader builds Python dictionaries, per-field byte annotations and hexadecimal copies of opaque data. Its allocations and timing intentionally include that inspection representation. They are not directly comparable to C++/WASM runtime import, nor representative of a compact future production reader. The copied corpus and all generated fixtures pass structural round trips.

## Validation and decision

Sixteen codec tests pass; 11 generated fixtures pass official acceptance and visual/interaction checks under each of Canvas2D and WebGL2. The generated shapes, animations, bone hierarchies and simple machines therefore demonstrate compatible export. Weighted mesh generation, broader semantics, native/mobile runtimes and hardware-GPU behavior remain untested.

Continue the measured `.riv` subset and use the official runtime as an oracle. Defer a new format until equivalent-content export and physical-device measurements demonstrate a reason to change it. See [the synthesis](05-synthesis.md) for the decision and remaining parity gates.

## Reproduction and raw data

Run `npm run research` from the repository root after `npm ci`. It regenerates this report from the following outputs:

- [Codec metrics](../research/results/codec-benchmark.json)
- [Canvas2D metrics](../research/results/runtime-benchmark-canvas.json)
- [WebGL2 metrics](../research/results/runtime-benchmark-webgl2.json)
- [Canvas2D validation](../research/results/runtime-validation-canvas.json)
- [WebGL2 validation](../research/results/runtime-validation-webgl2.json)
- [Pinned source evidence](sources.md)
- [Full workflow](../research/README.md)
