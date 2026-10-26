"""Verify the complete immutable source identity emitted by scripts/ui.py prepare."""
import hashlib
import json
from pathlib import Path


def source_identity(root):
    prepared = Path(root) / ".ui-workspace.json"
    if prepared.is_file():
        manifest = json.loads(prepared.read_text(encoding="utf-8"))
        digest = hashlib.sha256()
        for name, expected in sorted(manifest["files"].items()):
            data = (Path(root) / name).read_bytes()
            if b"\0" not in data:
                try:
                    data.decode("utf-8")
                    data = data.replace(b"\r\n", b"\n")
                except UnicodeDecodeError:
                    pass
            actual = hashlib.sha256(data).hexdigest()
            if actual != expected:
                raise RuntimeError(f"Prepared source changed: {name}")
            digest.update(name.encode() + b"\0" + actual.encode() + b"\n")
        if digest.hexdigest() != manifest["sourceHash"]:
            raise RuntimeError("Prepared sourceHash does not match its source files")
        return {key: manifest[key] for key in ("sourceSHA", "sourceHash")}
    raise RuntimeError("Capture requires a prepared workspace (.ui-workspace.json); run scripts/ui.py prepare")
