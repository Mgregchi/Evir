"""Inventory the supplied Editor export without dumping embedded asset data."""

import collections
import hashlib
import json
from pathlib import Path
from riv import parse, write

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / "research/fixtures/editor-corpus/sobo.riv"
data = source.read_bytes()
doc = parse(data)
artboards = []
for record in doc["objects"]:
    props = {
        p["name"]: p["value"] for p in record["properties"] if p["wire"] != "bytes"
    }
    if record["name"] == "Artboard":
        artboards.append(
            {
                "name": props["name"],
                "width": props.get("width"),
                "height": props.get("height"),
                "animations": [],
                "machines": [],
            }
        )
    elif artboards and record["name"] == "LinearAnimation":
        artboards[-1]["animations"].append(props)
    elif artboards and record["name"] == "StateMachine":
        artboards[-1]["machines"].append(props.get("name"))
roundtrips = {}
for label, raw in [("raw", True), ("encoded", False)]:
    rebuilt = write(doc, preserve_raw=raw)
    roundtrips[label] = rebuilt == data
    if rebuilt != data:
        raise AssertionError(f"{label} roundtrip changed the supplied export")
report = {
    "source": "User-supplied Rive Editor runtime export",
    "originalFilename": "28761-54484-sobo.riv",
    "receivedDate": "2026-10-08",
    "editorVersion": None,
    "exportedAt": None,
    "ownershipOrLicense": "Not supplied; this fixture retains its original ownership.",
    "sha256": hashlib.sha256(data).hexdigest(),
    "bytes": len(data),
    "format": {"major": doc["major"], "minor": doc["minor"]},
    "objects": len(doc["objects"]),
    "types": dict(
        sorted(collections.Counter(o["name"] for o in doc["objects"]).items())
    ),
    "unknownTypes": sorted(
        set(o["type"] for o in doc["objects"] if o["name"] == "unknown")
    ),
    "unknownPropertyKeys": sorted(
        set(
            p["key"]
            for o in doc["objects"]
            for p in o["properties"]
            if p["name"] == "unknown"
        )
    ),
    "roundtrips": roundtrips,
    "artboards": artboards,
    "interpretation": "Structural fidelity only; not full editable-project recovery or an independently authored equivalent scene.",
}
(ROOT / "research/results/editor-export-inventory.json").write_text(
    json.dumps(report, indent=2) + "\n"
)
print(
    f"{len(artboards)} artboards, {len(doc['objects'])} objects; both roundtrips exact"
)
