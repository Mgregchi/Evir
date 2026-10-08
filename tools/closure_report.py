"""Audit evidence and write an honest closure status; missing external evidence stays open."""

import argparse, hashlib, json, math, re, sys
from collections import Counter
from pathlib import Path
from riv import parse, write

ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT / "research/results"


def load(name):
    return json.loads((RESULTS / name).read_text())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--require-complete", action="store_true")
    args = parser.parse_args()
    files = sorted((ROOT / "research/fixtures").rglob("*.riv"))
    for path in files:
        assert (
            write(parse(path.read_bytes()), preserve_raw=True) == path.read_bytes()
        ), str(path)
    validations = []
    for backend in ["canvas", "webgl2"]:
        for phase, count in [
            ("runtime", 11),
            ("advanced", 8),
            ("complex", 14),
            ("closure", 19),
        ]:
            doc = load(f"{phase}-validation-{backend}.json")
            rows = doc["results"]
            assert len(rows) == count, (phase, backend)
            assert len({r["fixture"] for r in rows}) == count
            statuses = Counter(r.get("status", "passed") for r in rows)
            if phase != "closure":
                assert statuses == {"passed": count}
            else:
                assert statuses == (
                    {
                        "passed": 14,
                        "unrun-unsupported-backend": 4,
                        "confirmed-rejected-invalid-index": 1,
                    }
                    if backend == "canvas"
                    else {"passed": 18, "confirmed-rejected-invalid-index": 1}
                )
            validations.append(
                {
                    "phase": phase,
                    "backend": backend,
                    "outcomes": dict(statuses),
                    "evidence": f"research/results/{phase}-validation-{backend}.json",
                }
            )
    feather = load("feather-probe.json")
    assert Counter(r["status"] for r in feather["results"]) == {
        "passed-soft-edge-checks": 12,
        "passed-zero-strength-control": 2,
        "confirmed-skipped-invalid-fill-rule": 4,
    }
    rml = load("rml-export.json")
    assert len(rml["records"]) == 6
    for r in rml["records"]:
        assert not r["inspect_problems"]
        assert (
            hashlib.sha256((ROOT / r["output"]).read_bytes()).hexdigest() == r["sha256"]
        )
    benchmarks = {}
    for backend in ["canvas", "webgl2"]:
        doc = load(f"closure-benchmark-{backend}.json")
        assert {r["fixture"] for r in doc["results"]} == {
            "closure/weighted-mesh",
            "closure/data-binding",
            "closure/timed-transition",
        }
        for r in doc["results"]:
            assert (
                r["cold_samples"] == 3
                and r["warm_samples"] == 12
                and r["visible_pixels"] > 0
            )
        benchmarks[backend] = doc["results"]
    assert load("device-runner-smoke.json")["status"] == "passed"
    blockers = []
    physical = []
    required_fixtures = {
        "static",
        "animated",
        "bones",
        "state-machine",
        "characters-25",
        "stress-100",
        "closure/weighted-mesh",
        "closure/data-binding",
        "closure/timed-transition",
    }
    for kind in ["desktop", "android"]:
        for trial in [1, 2, 3]:
            file = ROOT / f"research/device-measurements/{kind}-{trial}.json"
            if not file.exists():
                continue
            d = json.loads(file.read_text())
            env = d["environment"]
            profile = env.get("deviceProfile") or {}
            valid = (
                profile.get("deviceClass") == kind
                and isinstance(profile.get("displayHz"), (float, int))
                and profile["displayHz"] > 0
            )
            valid = valid and all(
                isinstance(profile.get(k), str)
                and profile[k].strip()
                and "REPLACE" not in profile[k]
                for k in ["model", "os", "gpu", "driver", "powerMode", "runNotes"]
            )
            renderer = (env.get("graphics") or {}).get("renderer", "")
            valid = (
                valid
                and bool(renderer)
                and not re.search(
                    "swiftshader|llvmpipe|softpipe|software|swrast", renderer, re.I
                )
            )
            valid = valid and required_fixtures <= {r["fixture"] for r in d["results"]}
            valid = valid and all(
                r["cold_samples"] == 3
                and r["warm_samples"] == 12
                and r["visible_pixels"] > 0
                and math.isfinite(r["raf_fps"])
                and r["raf_fps"] > 0
                for r in d["results"]
            )
            if valid:
                physical.append(str(file.relative_to(ROOT)))
    if len(physical) != 6:
        blockers.append(
            {
                "item": "physical GPU and mobile measurements",
                "status": "blocked-external-device",
                "reason": "Six valid hardware trials (three desktop, three physical Android) with device provenance are required. Cloud software rendering and the local CDP smoke do not satisfy this item.",
                "instructions": "research/device-measurements/README.md",
                "acceptedTrials": physical,
            }
        )
    editor_file = RESULTS / "editor-comparison-webgl2.json"
    editor_valid = False
    if editor_file.exists():
        d = json.loads(editor_file.read_text())
        p = d.get("provenance", {})
        expected = {
            ("static", "default"),
            ("weighted-mesh", 0),
            ("weighted-mesh", 0.5),
            ("data-binding", "default"),
            ("data-binding", "changed"),
            ("feather", "default"),
        }
        rows = d.get("results", [])
        editor_valid = (
            p.get("exportSource") == "Rive Editor"
            and all(
                isinstance(p.get(k), str) and p[k].strip()
                for k in ["editorVersion", "exportedAt", "operator"]
            )
            and {(r["fixture"], r["pose"]) for r in rows} == expected
        )
        for r in rows:
            file = ROOT / f"research/fixtures/editor/{r['fixture']}.riv"
            editor_valid = (
                editor_valid
                and file.exists()
                and hashlib.sha256(file.read_bytes()).hexdigest() == r["sha256"]
                and r["status"] == "passed"
                and r["coverageA"] > 0
                and r["coverageB"] > 0
                and r["normalizedMae"] < 0.001
                and r["differentFraction"] < 0.01
            )
    if not editor_valid:
        blockers.append(
            {
                "item": "equivalent official Editor exports",
                "status": "blocked-external-editor-export",
                "reason": "Actual Editor exports, provenance and a passing six-pose WebGL2 comparison are required; official CLI exports cannot substitute.",
                "instructions": "research/editor-comparison/README.md",
            }
        )
    supplied_editor = None
    if (RESULTS / "editor-export-inventory.json").exists():
        inventory = load("editor-export-inventory.json")
        source = ROOT / "research/fixtures/editor-corpus/sobo.riv"
        assert hashlib.sha256(source.read_bytes()).hexdigest() == inventory["sha256"]
        assert inventory["roundtrips"] == {"raw": True, "encoded": True}
        expected_artboards = {a["name"] for a in inventory["artboards"]}
        expected_machines = {
            (a["name"], m) for a in inventory["artboards"] for m in a["machines"]
        }
        for backend in ["canvas", "webgl2"]:
            smoke = load(f"editor-export-{backend}.json")
            assert smoke["sourceSha256"] == inventory["sha256"]
            assert {r["artboard"] for r in smoke["records"]} == expected_artboards
            assert len(smoke["records"]) == len(expected_artboards)
            assert {
                (r["artboard"], r["machine"]) for r in smoke["machines"]
            } == expected_machines
            assert len(smoke["machines"]) == len(expected_machines)
            assert all(
                r["status"] == "passed" and r["initial"]["count"] > 0
                for r in smoke["records"]
            )
            assert all(
                r["status"] == "passed"
                and r["pixels"]["count"] > 0
                and r["machine"] in r["playing"]
                for r in smoke["machines"]
            )
        supplied_editor = {
            "sha256": inventory["sha256"],
            "artboardsPerBackend": len(expected_artboards),
            "stateMachinesPerBackend": len(expected_machines),
            "status": "passed-structural-and-rendering-smoke",
            "satisfiesEquivalentSceneComparison": False,
        }
    report = {
        "scope": "Targeted runtime/format research; not full Rive feature parity or an independent production renderer.",
        "status": "open-external-evidence" if blockers else "closed-for-declared-scope",
        "softwareChecks": "passed",
        "editorResearch": "started; user deferred device audit on 2026-10-08",
        "suppliedEditorExport": supplied_editor,
        "structuralRoundtripFiles": len(files),
        "positiveRuntimeValidations": sum(
            v["outcomes"].get("passed", 0) for v in validations
        ),
        "validations": validations,
        "featherOutcomes": dict(Counter(r["status"] for r in feather["results"])),
        "officialCliProjects": len(rml["records"]),
        "blockers": blockers,
        "limitations": [
            "No claim of complete Rive compatibility.",
            "No isolated GPU-completion or GPU-memory measurement.",
            "No physical iOS validation.",
            "Independent triangle lab is not a production renderer.",
            "Physical-device identity and Editor export provenance are operator assertions, not independent attestation.",
        ],
    }
    (RESULTS / "research-closure.json").write_text(json.dumps(report, indent=2) + "\n")
    print(
        json.dumps(
            {
                "status": report["status"],
                "positiveRuntimeValidations": report["positiveRuntimeValidations"],
                "structuralRoundtripFiles": len(files),
                "externalBlockers": len(blockers),
            },
            indent=2,
        )
    )
    if args.require_complete and blockers:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
