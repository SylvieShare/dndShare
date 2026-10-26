"""Content-addressed source copies, excluding runtime files and secrets."""
import hashlib
import os
from pathlib import Path
import tempfile

from .common import UIError, capture, identifier, read_json, write_json
from .dependencies import digest, link_modules

# Deliberately fixed: adding a source root is a reviewable code change.
SOURCE_ROOTS = {"README.md", "AGENTS.md", "CLAUDE.md", ".gitattributes", ".gitignore",
                "go.mod", "go.sum", "main.go", "cmd", "deploy", "frontend", "internal",
                "md", "native", "plans", "reports", "resources", "scripts", "skills", "design"}
RUNTIME_PARTS = {".git", "node_modules", "build", "target", "dist", "test-results",
                 "playwright-report", "__pycache__", ".gradle", ".kotlin", ".idea",
                 ".vite", ".vite-temp", ".cache", "coverage", ".pytest_cache", "models"}
MANIFEST = ".ui-workspace.json"


def included(relative):
    path = Path(relative)
    if not path.parts or path.parts[0] not in SOURCE_ROOTS:
        return False
    # The tracked embed placeholder is required for go:embed on a clean snapshot.
    if path.as_posix() == "internal/assets/dist/.gitkeep":
        return True
    if any(part in RUNTIME_PARTS for part in path.parts):
        return False
    name = path.name.lower()
    if (name.startswith(".env") or ".timestamp-" in name
            or name.endswith((".env", ".log", ".pyc", ".pyo", ".jks", ".p12", ".key", ".tsbuildinfo"))):
        return False
    return name not in {"local.properties", "credentials.json", "service-account.json", "id_rsa", "id_ed25519",
                        ".npmrc", ".netrc", "keystore.properties"}


def normalized(data):
    if b"\0" in data:
        return data
    try:
        data.decode("utf-8")
    except UnicodeDecodeError:
        return data
    return data.replace(b"\r\n", b"\n")


def source_files(source):
    names = capture(["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"], cwd=source)
    return sorted({name for name in names.split("\0") if included(name) and (source / name).is_file()})


def content(source, names):
    entries = {}
    for name in names:
        file = source / name
        if file.is_symlink():
            raise UIError(f"Source symlinks are not accepted: {name}")
        entries[name] = hashlib.sha256(normalized(file.read_bytes())).hexdigest()
    return entries


def content_hash(entries):
    result = hashlib.sha256()
    for name, value in sorted(entries.items()):
        result.update(name.encode("utf-8") + b"\0" + value.encode("ascii") + b"\n")
    return result.hexdigest()


def current(source):
    return content_hash(content(source, source_files(source)))


def prepare(source, config, destination=None, frozen=False):
    sha = capture(["git", "rev-parse", "HEAD"], cwd=source)
    names = source_files(source)
    base = source / "build/ui-workspaces"
    base.mkdir(parents=True, exist_ok=True)
    destination = Path(destination).resolve() if destination else base / f"{sha[:12]}-{identifier()}"
    if not destination.is_relative_to(base.resolve()) or destination == base.resolve():
        raise UIError("Workspace must be a new directory under " + str(base))
    try:
        destination.mkdir()  # Never delete or replace another workspace, even our previous one.
    except FileExistsError as error:
        raise UIError(f"Workspace already exists; choose a new path: {destination}") from error
    entries = {}
    for name in names:
        original = source / name
        if original.is_symlink():
            raise UIError(f"Source symlinks are not accepted: {name}")
        data = normalized(original.read_bytes())
        target = destination / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        target.chmod(original.stat().st_mode & 0o777)
        entries[name] = hashlib.sha256(data).hexdigest()
    hashed = content_hash(entries)
    if not frozen and (current(source) != hashed or capture(["git", "rev-parse", "HEAD"], cwd=source) != sha):
        raise UIError("Source changed during prepare; incomplete workspace retained: " + str(destination))
    hot = Path(tempfile.mkdtemp(prefix="dndshare-ui-"))
    link_modules(Path(config["node_modules"]), destination / "frontend/node_modules", hot)
    manifest = {"schema": 1, "source": str(source), "sourceSHA": sha, "sourceHash": hashed,
                "selection": "snapshot" if frozen else "current",
                "workspace": str(destination), "files": entries, "hotCache": str(hot),
                "lockHash": digest(destination / "frontend/package-lock.json"),
                "nodeModules": config["node_modules"], "config": str(source / "build/dev-tools/local-tools.json")}
    write_json(destination / MANIFEST, manifest)
    return destination, manifest


def resolve_workspace(source, workspace):
    workspace = Path(workspace).resolve()
    base = (source / "build/ui-workspaces").resolve()
    if not workspace.is_relative_to(base) or not (workspace / MANIFEST).is_file():
        raise UIError("Select an explicit prepared --workspace under " + str(base))
    return workspace


def workspace_files(workspace):
    names = set()
    placeholder = "internal/assets/dist/.gitkeep"
    if (workspace / placeholder).is_file():
        names.add(placeholder)
    for folder, directories, files in os.walk(workspace):
        relative = Path(folder).relative_to(workspace)
        directories[:] = [name for name in directories
                          if name not in RUNTIME_PARTS and (relative.parts or name in SOURCE_ROOTS)]
        for name in files:
            path = relative / name
            if name.lower().startswith(".env") or name.lower().endswith(".env"):
                raise UIError("Environment files are forbidden in a prepared workspace: " + str(path))
            if included(path):
                names.add(path.as_posix())
    return names


def validate(source, workspace, config, frozen=False):
    workspace = resolve_workspace(source, workspace)
    manifest = read_json(workspace / MANIFEST)
    if manifest.get("schema") != 1 or manifest.get("source") != str(source) or manifest.get("workspace") != str(workspace):
        raise UIError("Workspace manifest belongs to another source or location")
    if content_hash(manifest["files"]) != manifest["sourceHash"]:
        raise UIError("Workspace manifest content hash is invalid")
    if any(not included(name) or ".." in Path(name).parts for name in manifest["files"]):
        raise UIError("Invalid source path in manifest")
    if workspace_files(workspace) != set(manifest["files"]):
        raise UIError("Prepared source file selection was modified; run prepare again")
    if content(workspace, manifest["files"]) != manifest["files"]:
        raise UIError("Prepared source was modified; run prepare again")
    if digest(workspace / "frontend/package-lock.json") != manifest["lockHash"] or manifest["nodeModules"] != config["node_modules"]:
        raise UIError("Workspace dependencies changed; run prepare again")
    hot = Path(manifest["hotCache"])
    if not hot.is_relative_to(Path(tempfile.gettempdir())) or not hot.name.startswith("dndshare-ui-"):
        raise UIError("Invalid Linux cache path in manifest")
    hot.mkdir(exist_ok=True)
    for name in (".vite", ".vite-temp", ".cache"):
        (hot / name).mkdir(exist_ok=True)
    sha = capture(["git", "rev-parse", "HEAD"], cwd=source)
    if not frozen and (current(source) != manifest["sourceHash"] or sha != manifest["sourceSHA"]):
        raise UIError("Stale source selection; prepare again or explicitly use --snapshot")
    return workspace, manifest
