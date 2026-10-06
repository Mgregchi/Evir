"""Copy a small licensed corpus from the pinned upstream checkout."""

import hashlib, json, shutil, subprocess, sys
from pathlib import Path

root = Path(sys.argv[1])
out = Path("research/fixtures/upstream")
out.mkdir(parents=True, exist_ok=True)
names = [
    "artboardclipping.riv",
    "two_bone_ik.riv",
    "state_machine_transition.riv",
    "animation_reset_cases.riv",
    "library_with_text_and_image.riv",
]
manifest = []
for name in names:
    src = root / "tests/unit_tests/assets" / name
    dst = out / name
    shutil.copyfile(src, dst)
    manifest.append(
        {
            "file": str(dst),
            "source": "tests/unit_tests/assets/" + name,
            "sha256": hashlib.sha256(dst.read_bytes()).hexdigest(),
            "bytes": dst.stat().st_size,
        }
    )
shutil.copyfile(root / "LICENSE", out / "LICENSE.rive")
Path("research/fixtures/upstream/manifest.json").write_text(
    json.dumps(
        {
            "repository": "https://github.com/rive-app/rive-runtime",
            "commit": subprocess.check_output(
                ["git", "-C", str(root), "rev-parse", "HEAD"], text=True
            ).strip(),
            "files": manifest,
        },
        indent=2,
    )
    + "\n"
)
