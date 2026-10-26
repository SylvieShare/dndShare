"""Reuse locked dependencies and unpack already available browser library packages."""
import hashlib
import os
from pathlib import Path
import shutil

from .common import UIError, capture, read_json, write_json


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def check_packages(source, modules):
    packages = read_json(source / "frontend/package-lock.json")["packages"]
    for relative, package in packages.items():
        if not relative:
            continue
        installed = modules.parent / relative / "package.json"
        if package.get("optional") and not installed.is_file():
            continue
        if not installed.is_file() or read_json(installed).get("version") != package.get("version"):
            raise UIError(f"Locked dependency mismatch: {relative} in {modules}")
    core = read_json(modules / "playwright-core/package.json")["version"]
    expected = packages["node_modules/playwright-core"]["version"]
    if core != expected:
        raise UIError(f"Playwright {core} != package-lock {expected}")
    return core


def choose_modules(source, node, env):
    candidates = [source / "frontend/node_modules",
                  source / "build/unified-shell-validation/frontend/node_modules",
                  source / "build/header-validation-fc4a9a54/frontend/node_modules"]
    errors = []
    for modules in candidates:
        try:
            check_packages(source, modules)
            entry = modules / "vite/dist/node/index.js"
            capture([node, "--input-type=module", "-e", f"await import({str(entry)!r})"], env=env)
            return modules.resolve()
        except (OSError, UIError) as error:
            errors.append(str(error))
    raise UIError("No installed Linux dependency tree matches package-lock.json: " + "\n".join(errors))


def link_modules(modules, destination, hot):
    """Private cache directories; immutable installed packages are reused on C:."""
    destination.mkdir()
    for package in modules.iterdir():
        if package.name in {".vite", ".vite-temp", ".cache"}:
            continue
        if package.name == ".bin":
            shutil.copytree(package, destination / package.name, symlinks=True)
        elif package.name.startswith("@") and package.is_dir():
            scope = destination / package.name
            scope.mkdir()
            for child in package.iterdir():
                (scope / child.name).symlink_to(child, target_is_directory=child.is_dir())
        else:
            (destination / package.name).symlink_to(package, target_is_directory=package.is_dir())
    for name in (".vite", ".vite-temp", ".cache"):
        cache = hot / name
        cache.mkdir(parents=True)
        (destination / name).symlink_to(cache, target_is_directory=True)


def browser_libraries(source):
    root = source / "build/dev-tools/browser-libs"
    libraries = root / "root/usr/lib/x86_64-linux-gnu"
    if not libraries.exists():
        # Existing exact .deb packages, copied to C before unpacking. No apt/download.
        candidates = [Path("/var/cache/apt/archives"), Path("/tmp/share-ui-browser-libs")]
        selected = []
        for name in ("libnspr4", "libnss3", "libasound2t64"):
            matches = sorted(p for folder in candidates for p in folder.glob(name + "_*.deb"))
            if not matches:
                continue  # ldd and actual launch below decide whether the system is sufficient.
            selected.append(matches[-1])
        receipt = []
        for package in selected:
            stored = root / "packages" / package.name
            stored.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(package, stored)
            capture(["dpkg-deb", "-x", stored, root / "root"])
            receipt.append({"package": stored.name, "sha256": digest(stored)})
        write_json(root / "packages.json", receipt)
    return libraries


def environment(config):
    # Do not inherit DSNs, production credentials, browser selection, or test flags.
    allowed = {"HOME", "USER", "LOGNAME", "LANG", "LC_ALL", "WSL_INTEROP", "WSL_DISTRO_NAME",
               "SYSTEMROOT", "WINDIR", "LOCALAPPDATA", "USERPROFILE", "PATHEXT"}
    env = {key: value for key, value in os.environ.items() if key in allowed}
    env.update(PATH=os.pathsep.join([str(Path(config["node"]).parent),
                                    str(Path(config["go"]).parent), config["pg_bin"],
                                    "/usr/local/bin", "/usr/bin", "/bin"]),
               LD_LIBRARY_PATH=os.pathsep.join(config["library_paths"]),
               PLAYWRIGHT_BROWSERS_PATH=config["playwright_cache"],
               GOTOOLCHAIN="local", GOPATH=config["go_path"],
               GOCACHE=config["go_cache"], GOPROXY="off", GOSUMDB="off",
               PYTHONDONTWRITEBYTECODE="1", CI="1", NO_COLOR="1")
    if config.get("android_home"):
        env.update(ANDROID_HOME=config["android_home"], ANDROID_SDK_ROOT=config["android_home"],
                   JAVA_HOME=config["java_home"], DNDSHARE_POWERSHELL=config["powershell"])
    return env
