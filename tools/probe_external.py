"""Read-only capability checks; never print authentication output or credentials."""

import json, os, shutil, subprocess, urllib.request, urllib.error
from datetime import datetime, timezone
from pathlib import Path

cli = os.environ.get("RIVE_CLI", "rive")
auth = {"available": False, "check": "unrun-cli-unavailable"}
if shutil.which(cli):
    p = subprocess.run([cli, "whoami"], capture_output=True, text=True, timeout=20)
    auth = {
        "available": p.returncode == 0,
        "check": "read-only-whoami",
        "exitCode": p.returncode,
    }
endpoint = {"url": "https://editor.rive.app", "accountSessionVerified": False}
try:
    with urllib.request.urlopen(endpoint["url"], timeout=20) as response:
        endpoint["httpStatus"] = response.status
except (urllib.error.URLError, TimeoutError) as error:
    endpoint["httpStatus"] = getattr(error, "code", None)
    endpoint["reachable"] = False
record = {
    "checkedAtUtc": datetime.now(timezone.utc).isoformat(),
    "graphicsDeviceDirectoryPresent": Path("/dev/dri").exists(),
    "usbDeviceDirectoryPresent": Path("/dev/bus/usb").exists(),
    "adbInstalled": shutil.which("adb") is not None,
    "riveCliAuth": auth,
    "editorEndpoint": endpoint,
    "note": "Endpoint reachability does not establish authenticated Editor access or a real Editor export.",
}
Path("research/results/external-capabilities.json").write_text(
    json.dumps(record, indent=2) + "\n"
)
print(json.dumps(record, indent=2))
