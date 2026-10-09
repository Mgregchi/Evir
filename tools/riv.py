"""Research .riv v7 structural codec; no renderer or semantic importer."""

import argparse, json, math, struct
from pathlib import Path

SCHEMA = json.loads(
    (Path(__file__).resolve().parents[1] / "packages/format/schema/runtime.json").read_text()
)
TYPES = SCHEMA["types"]
PROPS = SCHEMA["properties"]


class FormatError(ValueError):
    pass


class Reader:
    def __init__(self, data):
        self.data = data
        self.pos = 0

    def take(self, n):
        if n < 0 or n > len(self.data) - self.pos:
            raise FormatError(f"truncated field at byte {self.pos}, need {n}")
        b = self.data[self.pos : self.pos + n]
        self.pos += n
        return b

    def uint(self, bits=64):
        v = 0
        for shift in range(0, 70, 7):
            b = self.take(1)[0]
            v |= (b & 127) << shift
            if not b & 128:
                if v >= 1 << bits:
                    raise FormatError(f"integer exceeds {bits} bits at {self.pos}")
                return v
        raise FormatError("unterminated/overflowing varuint")

    def value(self, wire):
        if wire in ("uint", "int"):
            v = self.uint(32 if wire == "int" else 64)
            return (v >> 1) ^ -(v & 1) if wire == "int" else v
        if wire == "float":
            return struct.unpack("<f", self.take(4))[0]
        if wire == "color":
            return struct.unpack("<I", self.take(4))[0]
        if wire == "bool":
            return self.take(1)[0] == 1
        b = self.take(self.uint())
        if wire == "string":
            try:
                return b.decode("utf-8")
            except UnicodeDecodeError as e:
                raise FormatError("invalid UTF-8") from e
        return b.hex()


def uint(v):
    if isinstance(v, bool) or not isinstance(v, int) or not 0 <= v < 1 << 64:
        raise FormatError("expected unsigned 64-bit integer")
    out = bytearray()
    while v >= 128:
        out.append((v & 127) | 128)
        v >>= 7
    out.append(v)
    return bytes(out)


def encode_value(wire, v):
    if wire == "int":
        if (
            not isinstance(v, int)
            or isinstance(v, bool)
            or not -(1 << 31) <= v < 1 << 31
        ):
            raise FormatError("expected signed 32-bit integer")
        return uint((v << 1) ^ (v >> 31))
    if wire == "uint":
        return uint(v)
    if wire == "float":
        if not isinstance(v, (int, float)) or not math.isfinite(v):
            raise FormatError("expected finite float")
        return struct.pack("<f", v)
    if wire == "color":
        return struct.pack("<I", v)
    if wire == "bool":
        if not isinstance(v, bool):
            raise FormatError("expected boolean")
        return bytes([int(v)])
    if wire == "string":
        b = v.encode("utf-8")
    elif wire == "bytes":
        b = bytes.fromhex(v)
    else:
        raise FormatError(f"unsupported wire type {wire}")
    return uint(len(b)) + b


def parse(data):
    r = Reader(data)
    if r.take(4) != b"RIVE":
        raise FormatError("missing RIVE fingerprint")
    major = r.uint(31)
    minor = r.uint(31)
    file_id = r.uint()
    if major != 7:
        raise FormatError(f"unsupported major version {major}")
    keys = []
    while True:
        k = r.uint(16)
        if not k:
            break
        if k in keys:
            raise FormatError("duplicate ToC key")
        keys.append(k)
    toc = {}
    for i in range(0, len(keys), 4):
        word = struct.unpack("<I", r.take(4))[0]
        for j, k in enumerate(keys[i : i + 4]):
            toc[str(k)] = (word >> (j * 2)) & 3
    header_end = r.pos
    objects = []
    while r.pos < len(data):
        start = r.pos
        typ = r.uint(16)
        fields = []
        while True:
            field_start = r.pos
            k = r.uint(16)
            if not k:
                break
            metadata = PROPS.get(str(k))
            cls = toc.get(str(k))
            wire = (
                metadata["wire"]
                if metadata
                else {0: "uint", 1: "bytes", 2: "float", 3: "color"}.get(cls)
            )
            if wire is None:
                raise FormatError(
                    f"unknown property {k} has no wire type at byte {field_start}"
                )
            value_start = r.pos
            v = r.value(wire)
            fields.append(
                {
                    "key": k,
                    "name": metadata["name"] if metadata else "unknown",
                    "wire": wire,
                    "value": v,
                    "offset": field_start,
                    "value_offset": value_start,
                    "end": r.pos,
                    "raw": data[value_start : r.pos].hex(),
                }
            )
        objects.append(
            {
                "type": typ,
                "name": TYPES.get(str(typ), {}).get("name", "unknown"),
                "offset": start,
                "end": r.pos,
                "properties": fields,
            }
        )
    return {
        "major": major,
        "minor": minor,
        "file_id": file_id,
        "toc": toc,
        "header_end": header_end,
        "size": len(data),
        "objects": objects,
    }


def write(doc, preserve_raw=False):
    if doc.get("major", 7) != 7:
        raise FormatError("writer supports major 7")
    out = bytearray(
        b"RIVE"
        + uint(doc.get("major", 7))
        + uint(doc.get("minor", 0))
        + uint(doc.get("file_id", 0))
    )
    toc = doc.get("toc", {})
    keys = list(toc)
    for k in keys:
        if not 0 < int(k) < 65536 or toc[k] not in range(4):
            raise FormatError("invalid ToC entry")
        out += uint(int(k))
    out += b"\0"
    for i in range(0, len(keys), 4):
        out += struct.pack(
            "<I", sum(toc[k] << (2 * j) for j, k in enumerate(keys[i : i + 4]))
        )
    for obj in doc["objects"]:
        if not 0 <= obj["type"] < 65536:
            raise FormatError("invalid object type")
        out += uint(obj["type"])
        for p in obj["properties"]:
            k = p["key"]
            metadata = PROPS.get(str(k))
            if not 0 < k < 65536:
                raise FormatError("invalid property key")
            expected = (
                metadata["wire"]
                if metadata
                else {0: "uint", 1: "bytes", 2: "float", 3: "color"}.get(
                    toc.get(str(k))
                )
            )
            if p["wire"] != expected:
                raise FormatError(f"property {k} wire mismatch or missing ToC")
            out += uint(k)
            out += (
                bytes.fromhex(p["raw"])
                if preserve_raw and "raw" in p
                else encode_value(p["wire"], p["value"])
            )
        out += b"\0"
    return bytes(out)


def obj(type_name, **values):
    typ = next(int(k) for k, t in TYPES.items() if t["name"] == type_name)
    props = {}
    t = TYPES[str(typ)]
    while t:
        for n, k in t["properties"].items():
            props.setdefault(n, k)
        t = next((x for x in TYPES.values() if x["name"] == t["parent"]), None)
    fields = []
    for n, v in values.items():
        k = props[n]
        fields.append({"key": k, "wire": PROPS[str(k)]["wire"], "value": v})
    return {"type": typ, "properties": fields}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("file", type=Path)
    p.add_argument("--json", action="store_true")
    p.add_argument("--roundtrip", type=Path)
    a = p.parse_args()
    d = parse(a.file.read_bytes())
    if a.roundtrip:
        a.roundtrip.write_bytes(write(d, preserve_raw=True))
    if a.json:
        print(json.dumps(d, indent=2))
    else:
        print(
            f"RIVE {d['major']}.{d['minor']}; {d['size']} bytes; header {d['header_end']} bytes; {len(d['objects'])} objects"
        )
        for o in d["objects"]:
            print(
                f"{o['offset']:06x}..{o['end']:06x} {o['type']:3} {o['name']}: "
                + ", ".join(
                    f"{p['key']}:{p['name']}={str(p['value'])[:90]}"
                    for p in o["properties"]
                )
            )


if __name__ == "__main__":
    main()
