"""Generate the benchmark report from retained machine-readable results."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT / "research/results"


def read(name):
    return json.loads((RESULTS / name).read_text())


def num(n):
    return f"{n:.3f}"


def main():
    codec = read("codec-benchmark.json")
    runtimes = {b: read(f"runtime-benchmark-{b}.json") for b in ["canvas", "webgl2"]}
    validations = {
        b: read(f"runtime-validation-{b}.json") for b in ["canvas", "webgl2"]
    }
    expected = {
        "static",
        "static-explicit-defaults",
        "animated",
        "bones",
        "state-machine",
        "stress-100",
        "characters-25",
        "states-2",
        "states-8",
        "states-32",
        "states-128",
    }
    for b in runtimes:
        assert {r["fixture"] for r in runtimes[b]["results"]} == expected
        assert {r["fixture"] for r in validations[b]["results"]} == expected
        for r in runtimes[b]["results"]:
            assert (
                r["cold_samples"] == 3
                and r["warm_samples"] == 12
                and r["raf_frames"] > 0
                and r["visible_pixels"] > 0
            )
    assert len(codec["results"]) == 16
    lines = [
        "# Benchmark results and practical limits",
        "",
        "These measurements exercise independently generated `.riv` files with official Rive runtimes. They establish an export-compatibility and performance baseline. There is no independent Evir renderer here, so these results do not establish an Evir-versus-Rive speedup or full engine parity. The Python codec is measured separately because it performs structural parsing, not complete runtime import.",
        "",
        "This report covers the original baseline. See [extended experiments](07-extended-experiments.md) for subsequent semantic probes, official RML exports and the independent triangle lab.",
        "",
        "## Environment and method",
        "",
        f"Python {codec['environment']['python']}; Node {runtimes['canvas']['environment']['node']}; Chromium {runtimes['canvas']['environment']['chromium']}; Playwright {runtimes['canvas']['environment']['playwright']}. Both official web packages are pinned at 2.44.0. The canvas is 256×256 on headless Linux {runtimes['canvas']['environment']['arch']}.",
        "",
        f"Graphics implementation: `{runtimes['webgl2']['environment']['graphics']['renderer']}`. This is software rendering, not a physical GPU. No mobile device was measured.",
        "",
        "- Codec: three warmups, 25 sequential samples per file using `perf_counter_ns`; median and nearest-rank p95. A separate tracemalloc pass measures Python peak traced allocations.",
        "- Official loading: three fresh-page loads and 12 warm loads per fixture. Fresh-page time includes runtime/WASM initialization, HTTP fetch, decoding and import; HTTP/browser caches may be warm. Warm time reuses the runtime module but constructs a new playback instance. Small-file fetch overhead is included, so the result is not pure parser speed.",
        "- Playback: a two-second observation after 250 ms warmup. Animation discovery and motion are checked. `stress-100` runs all 100 timelines; `characters-25` enables its Dance controller. N-state selectors change target every rAF.",
        "- Frame metrics: rAF cadence measures scheduling. Runtime callback CPU time comes from the pinned package’s rolling one-second internal `durations` array and includes scene advancement, draw submission/flush or draw skipping. It excludes asynchronous GPU completion. The internal probe is version-sensitive and fails rather than substituting a different metric if it is absent.",
        "- Memory: JavaScript used heap, WASM linear-memory capacity and renderer-process RSS are distinct observations. They overlap and must not be added together. RSS includes shared pages and browser state, including renderer processes retained after fresh-page trials. WASM capacity is allocated capacity, not live scene memory. Sequential warm runs share a module, so memory is not a clean per-fixture allocation delta.",
        "- Sample sizes are descriptive; they do not support confidence intervals or broad device-performance claims. Browser callback timing has finite resolution, and reported zero-duration callbacks are timer quantization rather than zero-cost work.",
        "",
        "## File size and binary efficiency",
        "",
        "| Fixture | Bytes | Objects | Bytes/object | gzip bytes | Embedded asset bytes |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    for r in codec["results"]:
        name = Path(r["file"]).stem
        lines.append(
            f"| {name} | {r['bytes']:,} | {r['objects']:,} | {r['bytes_per_object']:.2f} | {r['gzip_bytes']:,} | {r['embedded_asset_bytes']:,} |"
        )
    lines += [
        "",
        "The compact static export is 76 bytes; the same scene with explicitly serialized defaults is 138 bytes. Both produce the same pixels within each renderer. Omitting these defaults reduces this particular export by 44.9%. This compares two policies of our own writer; no official editor-export superiority claim follows. gzip can add overhead to tiny files, while larger typed streams compress well. Embedded assets change bytes/object dramatically, so that ratio is not an intrinsic measure of animation-engine quality.",
        "",
        "## Official load and playback measurements",
        "",
        "| Backend | Fixture | Fresh-page median ms | Warm median / p95 ms | Callback CPU median / p95 ms | rAF Hz |",
        "|---|---|---:|---:|---:|---:|",
    ]
    for backend, data in runtimes.items():
        for r in data["results"]:
            cpu = r["runtime_callback_cpu_ms"]
            cpu_text = (
                f"{num(cpu['median'])} / {num(cpu['p95'])}" if cpu else "not sampled"
            )
            lines.append(
                f"| {backend} | {r['fixture']} | {num(r['cold_page_load_ms']['median'])} | {num(r['warm_load_ms']['median'])} / {num(r['warm_load_ms']['p95'])} | {cpu_text} | {r['raf_fps']:.2f} |"
            )
    lines += [
        "",
        "The observed ~60 Hz cadence is consistent with this browser’s frame scheduler; it does not establish maximum throughput or mobile 60 FPS. A static scene or settled controller can skip actual drawing while callbacks continue. Our checks establish that the animated workloads visibly change, but GPU-completion latency is not measured. Software WebGL2 initialization and shader/renderer state can dominate warm loads for these small scenes. A different backend or hardware GPU can reverse that comparison.",
        "",
        "## Memory observations",
        "",
        "| Backend | Fixture | JS used heap MiB | WASM capacity MiB |",
        "|---|---|---:|---:|",
    ]
    for backend, data in runtimes.items():
        for r in data["results"]:
            if r["fixture"] in ["static", "characters-25", "stress-100", "states-128"]:
                w = r["wasm_linear_capacity_bytes"]
                lines.append(
                    f"| {backend} | {r['fixture']} | {r['js_heap_bytes']/2**20:.2f} | {w/2**20:.2f} |"
                    if w
                    else f"| {backend} | {r['fixture']} | {r['js_heap_bytes']/2**20:.2f} | unavailable |"
                )
    lines += [
        "",
        "Per-process RSS snapshots and timing spreads are retained in the raw runtime JSON. These are cloud-browser observations, not mobile memory budgets or isolated file memory requirements. The browser/renderer/runtime baseline can dwarf a 76-byte scene.",
        "",
        "## Independent Python codec",
        "",
        "| Fixture | Parse median / p95 ms | Preserve-write median ms | Peak traced parse allocation KiB |",
        "|---|---:|---:|---:|",
    ]
    for r in codec["results"]:
        lines.append(
            f"| {Path(r['file']).stem} | {num(r['parse_ms']['median'])} / {num(r['parse_ms']['p95'])} | {num(r['write_preserving_raw_ms']['median'])} | {r['python_peak_alloc_bytes']/1024:.1f} |"
        )
    lines += [
        "",
        "The reader builds Python dictionaries, per-field byte annotations and hexadecimal copies of opaque data. Its allocations and timing intentionally include that inspection representation. They are not directly comparable to C++/WASM runtime import, nor representative of a compact future production reader. The copied corpus and all generated fixtures pass structural round trips.",
        "",
        "## Validation and decision",
        "",
        "Sixteen codec tests pass; 11 generated fixtures pass official acceptance and visual/interaction checks under each of Canvas2D and WebGL2. The generated shapes, animations, bone hierarchies and simple machines therefore demonstrate compatible export. Weighted mesh generation, broader semantics, native/mobile runtimes and hardware-GPU behavior remain untested.",
        "",
        "Continue the measured `.riv` subset and use the official runtime as an oracle. Defer a new format until equivalent-content export and physical-device measurements demonstrate a reason to change it. See [the synthesis](05-synthesis.md) for the decision and remaining parity gates.",
        "",
        "## Reproduction and raw data",
        "",
        "Run `npm run research` from the repository root after `npm ci`. It regenerates this report from the following outputs:",
        "",
        "- [Codec metrics](../research/results/codec-benchmark.json)",
        "- [Canvas2D metrics](../research/results/runtime-benchmark-canvas.json)",
        "- [WebGL2 metrics](../research/results/runtime-benchmark-webgl2.json)",
        "- [Canvas2D validation](../research/results/runtime-validation-canvas.json)",
        "- [WebGL2 validation](../research/results/runtime-validation-webgl2.json)",
        "- [Pinned source evidence](sources.md)",
        "- [Full workflow](../research/README.md)",
        "",
    ]
    (ROOT / "docs/04-benchmarks.md").write_text("\n".join(lines))
    print(
        "Generated docs/04-benchmarks.md from 16 codec rows and 22 official-runtime rows"
    )


if __name__ == "__main__":
    main()
