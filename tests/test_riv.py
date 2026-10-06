import hashlib, json, struct, sys, unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from riv import Reader, FormatError, uint, parse, write, obj, encode_value

ROOT = Path(__file__).resolve().parents[1]


class WireTests(unittest.TestCase):
    def test_independent_empty_artboard_golden(self):
        # RIVE, v7.0, file id 0, empty ToC; Backboard; 256x256 Artboard.
        golden = bytes.fromhex("52495645070000001700010700008043080000804300")
        d = parse(golden)
        self.assertEqual(d["objects"][1]["name"], "Artboard")
        self.assertEqual(d["objects"][1]["properties"][0]["value"], 256)
        self.assertEqual(
            write(
                {"objects": [obj("Backboard"), obj("Artboard", width=256, height=256)]}
            ),
            golden,
        )

    def test_varuint_boundaries(self):
        for n in [0, 127, 128, 16383, 16384, (1 << 32) - 1, (1 << 64) - 1]:
            with self.subTest(n=n):
                self.assertEqual(Reader(uint(n)).uint(), n)
        self.assertEqual(uint(128), b"\x80\x01")
        self.assertEqual(uint(16384), b"\x80\x80\x01")

    def test_varuint_errors(self):
        for b in [b"\x80", b"\x80" * 10, b"\xff" * 9 + b"\x02"]:
            with self.assertRaises(FormatError):
                Reader(b).uint()
        with self.assertRaises(FormatError):
            Reader(uint(1 << 32)).uint(32)

    def test_uint_write_range(self):
        for n in [-1, 1 << 64, 1.5, True]:
            with self.assertRaises(FormatError):
                uint(n)

    def test_zigzag(self):
        self.assertEqual(encode_value("int", -1), b"\x01")
        for n in [-(1 << 31), -100, 0, 100, (1 << 31) - 1]:
            self.assertEqual(Reader(encode_value("int", n)).value("int"), n)
        with self.assertRaises(FormatError):
            encode_value("int", 1 << 31)

    def test_scalar_encoding(self):
        self.assertEqual(encode_value("float", 1.5), bytes.fromhex("0000c03f"))
        self.assertEqual(encode_value("color", 0xFF123456), bytes.fromhex("563412ff"))
        self.assertEqual(Reader(b"\x02").value("bool"), False)
        self.assertEqual(encode_value("string", "é"), b"\x02\xc3\xa9")
        self.assertEqual(encode_value("bytes", "00ff"), b"\x02\x00\xff")

    def test_bad_scalar(self):
        for b, wire in [
            (b"\x04a", "bytes"),
            (b"\x01\xff", "string"),
            (b"123", "float"),
        ]:
            with self.assertRaises(FormatError):
                Reader(b).value(wire)
        with self.assertRaises(FormatError):
            encode_value("float", float("nan"))
        with self.assertRaises(FormatError):
            encode_value("bool", 1)

    def test_invalid_headers(self):
        for b in [b"", b"RIV", b"NOPE", b"RIVE\x08\0\0\0", b"RIVE\x80"]:
            with self.assertRaises(FormatError):
                parse(b)

    def test_forward_compatible_unknown_object(self):
        doc = {
            "toc": {"65000": 0, "65001": 1, "65002": 2, "65003": 3, "65004": 0},
            "objects": [
                {
                    "type": 64000,
                    "properties": [
                        {"key": 65000, "wire": "uint", "value": 128},
                        {"key": 65001, "wire": "bytes", "value": "ff00"},
                        {"key": 65002, "wire": "float", "value": 1.5},
                        {"key": 65003, "wire": "color", "value": 0xFF123456},
                        {"key": 65004, "wire": "uint", "value": 7},
                    ],
                }
            ],
        }
        data = write(doc)
        d = parse(data)
        self.assertEqual(d["toc"], doc["toc"])
        self.assertEqual(d["objects"][0]["name"], "unknown")
        self.assertEqual(write(d, True), data)

    def test_unknown_without_toc(self):
        with self.assertRaisesRegex(FormatError, "unknown property"):
            parse(b"RIVE\x07\0\0\0" + uint(64000) + uint(65000) + b"\0\0")

    def test_writer_type_mismatch(self):
        with self.assertRaises(FormatError):
            write(
                {
                    "objects": [
                        {
                            "type": 1,
                            "properties": [{"key": 7, "wire": "uint", "value": 256}],
                        }
                    ]
                }
            )

    def test_truncated_object_fields(self):
        data = write({"objects": [obj("Artboard", width=256, name="Test")]})
        for i in range(9, len(data)):
            with self.subTest(i=i), self.assertRaises(FormatError):
                parse(data[:i])

    def test_edit_property(self):
        d = parse(write({"objects": [obj("Artboard", width=256)]}))
        d["objects"][0]["properties"][0]["value"] = 128
        self.assertEqual(parse(write(d))["objects"][0]["properties"][0]["value"], 128)

    def test_duplicate_toc(self):
        with self.assertRaises(FormatError):
            parse(b"RIVE\x07\0\0" + uint(65000) + uint(65000) + b"\0" + b"\0" * 4)

    def test_corpus_sha_and_lossless_roundtrips(self):
        manifest = json.loads(
            (ROOT / "research/fixtures/upstream/manifest.json").read_text()
        )
        self.assertEqual(len(manifest["files"]), 5)
        for f in manifest["files"]:
            data = (ROOT / f["file"]).read_bytes()
            with self.subTest(file=f["file"]):
                self.assertEqual(hashlib.sha256(data).hexdigest(), f["sha256"])
                self.assertEqual(write(parse(data), True), data)

    def test_generated_roundtrips(self):
        files = list((ROOT / "research/fixtures").glob("*.riv"))
        self.assertEqual(len(files), 11)
        for p in files:
            with self.subTest(file=p.name):
                self.assertEqual(write(parse(p.read_bytes())), p.read_bytes())


if __name__ == "__main__":
    unittest.main()
