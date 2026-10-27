"""Verify the complete immutable source identity emitted by scripts/ui.py prepare."""
import hashlib
import json
import fcntl
import os
from pathlib import Path


def guarded_identity(root, manifest):
    """Borrow only a live owning runner's check, while it holds this worktree lock."""
    location = os.environ.get('DNDSHARE_UI_GUARD_RECEIPT')
    if not location:
        return None
    row = json.loads(Path(location).read_text())
    pid = row.get('runnerPid', -1)
    try:
        start = Path(f'/proc/{pid}/stat').read_text().rsplit(')', 1)[1].split()[19]
    except OSError as error:
        raise RuntimeError('Source verification owner is no longer alive') from error
    expected = {key: manifest[key] for key in ('sourceSHA', 'sourceHash')}
    if (row.get('status') != 'running' or row.get('runnerStart') != start or pid != os.getppid()
            or row.get('workspace') != str(Path(root).resolve())
            or any(row.get(key) != value for key, value in expected.items())
            or row.get('sourceVerification', {}).get('beforeHash') != expected['sourceHash']):
        raise RuntimeError('Invalid owning runner source verification')
    with (Path(root) / '.ui-run.lock').open('a') as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return expected
        finally:
            fcntl.flock(handle, fcntl.LOCK_UN)
    raise RuntimeError('Source verification owner does not hold the worktree lock')


def source_identity(root):
    prepared = Path(root) / ".ui-workspace.json"
    if prepared.is_file():
        manifest = json.loads(prepared.read_text(encoding="utf-8"))
        guarded = guarded_identity(root, manifest)
        if guarded:
            return guarded
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
