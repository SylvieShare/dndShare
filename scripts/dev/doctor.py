"""Actual runtime probes, repeated for every CLI invocation."""
import re
import subprocess

from . import windows
from .common import UIError, capture, read_json, write_json
from .dependencies import check_packages, environment


def inspect(source, config, directory, emulator=None, capabilities=None, require_device=True):
    env = environment(config)
    checks = []
    installed_version = None

    def installed_packages():
        nonlocal installed_version
        if installed_version is None:
            from pathlib import Path
            installed_version = check_packages(source, Path(config['node_modules']))
        return installed_version

    def check(name, operation):
        if capabilities is not None and name not in capabilities:
            return
        try:
            detail = operation()
            checks.append({"name": name, "status": "passed", "detail": detail})
        except (OSError, ValueError, UIError, subprocess.TimeoutExpired) as error:
            checks.append({"name": name, "status": "failed", "detail": str(error)})
        print(f"doctor {name}: {checks[-1]['status']}", flush=True)

    def version(command, expected, exact=False):
        actual = capture(command, env=env)
        matches = actual == expected if exact else expected in actual
        if not matches:
            raise UIError(f"Expected {expected}; got {actual}")
        return actual

    check("node", lambda: version([config["node"], "--version"], "v" + config["node_version"], exact=True))
    go_version = re.search(r"^go\s+(\S+)", (source / "go.mod").read_text(), re.M).group(1)
    check("go", lambda: version([config["go"], "version"], "go" + go_version + " "))
    check("postgres16", lambda: {name: version([config["pg_bin"] + "/" + name, "--version"], "16.")
                                 for name in ("postgres", "initdb", "pg_ctl", "createdb")})

    def dependencies():
        from pathlib import Path
        modules = Path(config["node_modules"])
        installed = installed_packages()
        entry = modules / "vite/dist/node/index.js"
        capture([config["node"], "--input-type=module", "-e", f"await import({str(entry)!r})"], env=env)
        return {"playwright": installed, "viteImport": "passed"}

    check("dependencies", dependencies)

    def browser():
        from pathlib import Path
        modules = Path(config["node_modules"])
        installed = installed_packages()
        browsers = read_json(modules / "playwright-core/browsers.json")["browsers"]
        revision = next(item["revision"] for item in browsers if item["name"] == "chromium-headless-shell")
        executables = list(Path(config["playwright_cache"]).glob(f"chromium_headless_shell-{revision}/**/chrome-headless-shell"))
        if len(executables) != 1:
            raise UIError(f"Installed Chromium headless revision {revision} is missing or ambiguous")
        executable = executables[0]
        linked = capture(["ldd", executable], env=env)
        if "not found" in linked:
            raise UIError("Chromium libraries missing: " + linked)
        entry = modules / "playwright/index.mjs"
        script = f"""
const {{ chromium }} = await import({str(entry)!r});
const browser = await chromium.launch({{headless:true,executablePath:{str(executable)!r}}});
try {{
 const page = await browser.newPage(); await page.setContent('<title>ui-doctor</title>');
 if (await page.title() !== 'ui-doctor') throw new Error('Chromium DOM probe failed');
 console.log(JSON.stringify({{version:browser.version(),executable:{str(executable)!r}}}));
}} finally {{ await browser.close(); }}
"""
        launched = capture([config["node"], "--input-type=module", "-e", script], env=env)
        return {"playwright": installed, "chromium_revision": revision, "launch": launched}

    check("playwright-chromium", browser)
    check("android", lambda: windows.probe(config, source, emulator, require_device=require_device))
    result = {"source": str(source), "capabilities": sorted(capabilities) if capabilities is not None else "all",
              "requiresRunningEmulator": require_device, "checks": checks,
              "status": "passed" if all(x["status"] == "passed" for x in checks) else "failed"}
    write_json(directory / "doctor.json", result)
    (directory / "doctor.log").write_text("\n".join(f"{c['name']}: {c['detail']}" for c in checks), encoding="utf-8")
    if result["status"] != "passed":
        raise UIError("Doctor failed; see " + str(directory / "doctor.json"))
    return result
