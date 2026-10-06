"""Time Python structural parsing separately from official runtime import."""

import gzip, hashlib, json, os, platform, statistics, sys, time, tracemalloc
from pathlib import Path
from riv import parse, write

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "research/results"
OUT.mkdir(exist_ok=True)


def summary(v):
    v = sorted(v)
    return {
        "median": statistics.median(v),
        "p95": v[min(len(v) - 1, int(len(v) * 0.95))],
        "min": v[0],
        "max": v[-1],
    }


rows = []
for p in sorted((ROOT / "research/fixtures").rglob("*.riv")):
    data = p.read_bytes()
    doc = parse(data)
    assert write(doc, True) == data
    for _ in range(3):
        parse(data)
    times = []
    enc = []
    for _ in range(25):
        t = time.perf_counter_ns()
        parse(data)
        times.append((time.perf_counter_ns() - t) / 1e6)
        t = time.perf_counter_ns()
        write(doc, True)
        enc.append((time.perf_counter_ns() - t) / 1e6)
    tracemalloc.start()
    d = parse(data)
    _, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    embedded = sum(
        len(bytes.fromhex(f["value"]))
        for o in doc["objects"]
        for f in o["properties"]
        if f["name"] == "bytes" and f["wire"] == "bytes"
    )
    authored = p.with_suffix(".json")
    json_bytes = authored.stat().st_size if authored.exists() else None
    rows.append(
        {
            "file": str(p.relative_to(ROOT)),
            "sha256": hashlib.sha256(data).hexdigest(),
            "bytes": len(data),
            "gzip_bytes": len(gzip.compress(data, mtime=0)),
            "authored_pretty_json_bytes": json_bytes,
            "objects": len(doc["objects"]),
            "properties": sum(len(o["properties"]) for o in doc["objects"]),
            "bytes_per_object": len(data) / len(doc["objects"]),
            "embedded_asset_bytes": embedded,
            "parse_ms": summary(times),
            "write_preserving_raw_ms": summary(enc),
            "python_peak_alloc_bytes": peak,
            "samples": 25,
        }
    )
out = {
    "environment": {
        "python": platform.python_version(),
        "platform": platform.platform(),
        "machine": platform.machine(),
        "cpu_count": os.cpu_count(),
    },
    "method": "3 warmups, 25 sequential perf_counter_ns samples; p95 nearest rank; tracemalloc separately; Python structural parse only, not official import or render",
    "results": rows,
}
(OUT / "codec-benchmark.json").write_text(json.dumps(out, indent=2) + "\n")
print("Benchmarked", len(rows), "files")
# Human-readable annotated records without dumping embedded payloads.
for p in [
    ROOT / "research/fixtures/static.riv",
    ROOT / "research/fixtures/upstream/artboardclipping.riv",
]:
    d = parse(p.read_bytes())
    lines = [
        f"{p.name}: RIVE {d['major']}.{d['minor']}; header ends at 0x{d['header_end']:x}; {d['size']} bytes",
        p.read_bytes().hex(" ") + "\n",
    ]
    for o in d["objects"]:
        lines.append(
            f"0x{o['offset']:04x}..0x{o['end']:04x}: type {o['type']} ({o['name']})"
        )
        for f in o["properties"]:
            lines.append(
                f"  0x{f['offset']:04x}..0x{f['end']:04x}: property {f['key']} {f['name']} ({f['wire']}) = {f['value']}"
            )
    (OUT / (p.stem + "-annotated.txt")).write_text("\n".join(lines) + "\n")
