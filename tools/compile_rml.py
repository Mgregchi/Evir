"""Compile retained RML with the official CLI and record fresh outputs."""

import hashlib, json, os, shutil, subprocess, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
cli = os.environ.get("RIVE_CLI", "rive")
version = subprocess.check_output([cli, "--version"], text=True).strip()
records = []
for name in [
    "static",
    "feather",
    "winding",
    "direct-blend",
    "weighted-mesh",
    "data-binding",
]:
    source = ROOT / "research/rml" / name
    with tempfile.TemporaryDirectory(prefix="evir-rml-") as tmp:
        project = Path(tmp)
        for file in source.iterdir():
            if file.is_file() and file.suffix in {".rml", ".yaml", ".png"}:
                shutil.copyfile(file, project / file.name)
        subprocess.run([cli, str(project), "--verify"], check=True)
        inspection = json.loads(
            subprocess.check_output([cli, "inspect", str(project), "--json"], text=True)
        )
        if inspection["problems"]:
            raise RuntimeError(inspection["problems"])
        subprocess.run([cli, str(project), "--once"], check=True)
        built = project / "build" / f"rml-{name}.riv"
        data = built.read_bytes()
        group = (
            "advanced"
            if name in ["static", "feather"]
            else "complex" if name in ["winding", "direct-blend"] else "closure"
        )
        dest = ROOT / "research/fixtures" / group / built.name
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        (ROOT / f"research/results/rml-{name}-inspect.json").write_text(
            json.dumps(inspection, indent=2) + "\n"
        )
        records.append(
            {
                "source": str(source.relative_to(ROOT)),
                "output": str(dest.relative_to(ROOT)),
                "bytes": len(data),
                "sha256": hashlib.sha256(data).hexdigest(),
                "inspect_problems": [],
            }
        )
(ROOT / "research/results/rml-export.json").write_text(
    json.dumps({"cli": version, "records": records}, indent=2) + "\n"
)
print(version, "compiled", len(records), "fresh projects")
