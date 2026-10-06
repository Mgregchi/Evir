"""Extract runtime wire metadata from pinned generated upstream headers."""

import json, re, sys
from pathlib import Path

root = Path(sys.argv[1])
types = {}
props = {}
wire = {
    "Uint": "uint",
    "Uint64": "uint",
    "Id": "uint",
    "Int": "int",
    "String": "string",
    "Bytes": "bytes",
    "Double": "float",
    "Color": "color",
    "Bool": "bool",
}
for p in sorted((root / "include/rive/generated").rglob("*_base.hpp")):
    s = p.read_text()
    c = re.search(r"class (\w+)Base : public (\w+)", s)
    t = re.search(r"typeKey = (\d+)", s)
    if not c or not t:
        continue
    keys = dict((n, int(v)) for n, v in re.findall(r"(\w+)PropertyKey = (\d+)", s))
    types[t[1]] = {
        "name": c[1],
        "parent": c[2],
        "properties": keys,
        "source": str(p.relative_to(root)),
    }
    for n, block in re.findall(
        r"case (\w+)PropertyKey:(.*?)(?=case |\n        \}|\n    \})", s, re.S
    ):
        m = re.search(
            r"Core(\w+)Type::(?:runtimeDeserialize|deserialize)\(reader\)", block
        )
        if m and m[1] in wire and n in keys:
            k = str(keys[n])
            v = {"name": n, "wire": wire[m[1]]}
            if k in props and props[k] != v:
                raise ValueError((k, props[k], v))
            props[k] = v
registry = (
    (root / "include/rive/generated/core_registry.hpp")
    .read_text()
    .split("static int propertyFieldId(int propertyKey)", 1)[1]
    .split("static ", 1)[0]
)
by_name = {t["name"]: t for t in types.values()}
for block, kind in re.findall(r"(.*?)return Core(\w+)Type::id;", registry, re.S):
    for class_name, field in re.findall(r"case (\w+)Base::\s*(\w+)PropertyKey:", block):
        if class_name not in by_name or field not in by_name[class_name]["properties"]:
            continue
        k = str(by_name[class_name]["properties"][field])
        if k not in props and kind in wire:
            props[k] = {"name": field, "wire": wire[kind]}
import subprocess

out = {
    "upstream": "https://github.com/rive-app/rive-runtime",
    "commit": subprocess.check_output(
        ["git", "-C", str(root), "rev-parse", "HEAD"], text=True
    ).strip(),
    "types": types,
    "properties": props,
}
Path(sys.argv[2]).write_text(json.dumps(out, indent=2) + "\n")
print(len(types), "types", len(props), "properties")
