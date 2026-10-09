"""Inventory user-supplied .riv files without publishing their embedded artwork."""

import argparse
import collections
import hashlib
import json
from pathlib import Path
from riv import parse, write


def inspect(source):
    data = source.read_bytes()
    document = parse(data)
    boards = []
    for obj in document["objects"]:
        props = {p["name"]: p["value"] for p in obj["properties"] if p["wire"] != "bytes"}
        if obj["name"] == "Artboard":
            boards.append({"name": props.get("name"), "width": props.get("width"),
                           "height": props.get("height"), "animations": [], "machines": []})
        elif boards and obj["name"] == "LinearAnimation":
            boards[-1]["animations"].append({k: props.get(k) for k in ["name", "fps", "duration", "loopValue"]})
        elif boards and obj["name"] == "StateMachine":
            boards[-1]["machines"].append(props.get("name"))
    raw_exact = write(document, preserve_raw=True) == data
    encoded_exact = write(document, preserve_raw=False) == data
    if not raw_exact or not encoded_exact:
        raise AssertionError("A codec round trip changed the supplied file")
    return {"filename": source.name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(),
            "status": "inspected", "format": {"major": document["major"], "minor": document["minor"]},
            "objects": len(document["objects"]), "types": dict(sorted(collections.Counter(o["name"] for o in document["objects"]).items())),
            "unknownTypes": sorted({o["type"] for o in document["objects"] if o["name"] == "unknown"}),
            "unknownPropertyKeys": sorted({p["key"] for o in document["objects"] for p in o["properties"] if p["name"] == "unknown"}),
            "roundtrips": {"raw": raw_exact, "encoded": encoded_exact}, "artboards": boards}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", type=Path, nargs="+")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--blocked", action="append", default=[])
    args = parser.parse_args()
    records = []
    for file in args.files:
        item = inspect(file)
        records.append(item)
        print(f"{file.name}: {item['objects']} objects, {len(item['artboards'])} artboards, both roundtrips exact", flush=True)
    records.extend({"filename": name, "status": "blocked", "reason": "Uploaded file exceeds the executor's 32 MiB transfer limit; no file content inspected."} for name in args.blocked)
    report = {"receivedDate": "2026-10-09", "source": "User-supplied runtime exports; no editable .rev backups supplied.",
              "reuse": "Research inputs only. Public-site assets use independently authored Evir projects; no ownership or redistribution license inferred.",
              "scope": "Structural inventory and exact codec roundtrips, not semantic import, equal-scene parity or physical-device performance.", "files": records}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n")
