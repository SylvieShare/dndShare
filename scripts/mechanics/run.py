"""Run only sheet-mechanics tests. Both runtimes read the same golden inputs and outputs."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent


def run(command, cwd=ROOT):
    subprocess.run([str(part) for part in command], cwd=cwd, check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--client", choices=["web", "android", "both"], default="both")
    args = parser.parse_args()
    suites = json.loads((HERE / "suites.json").read_text(encoding="utf8"))
    run([sys.executable, "-m", "unittest", "discover", "-s", HERE])
    run(["go", "test", "./scripts/mechanics/editor-schema", "./internal/store", "-run", "StatusSave|PreparedCharacterRoll|ApplicationHealing|ApplicationConcentration|ApplicationFormula|FeatCanRecreate|StatusDurationKeeps"])
    if args.client in ("both", "web"):
        web = ROOT / "frontend"
        files = sorted({path for suite in suites for path in suite["web"]})
        for path in files:
            if not (web / path).is_file():
                raise FileNotFoundError(path)
        shared = sorted((web / "tests/game-mechanics").glob("*.test.js"))
        run(["node", "node_modules/vitest/vitest.mjs", "run", *(p.relative_to(web) for p in shared), *files], web)
        run(["node", "scripts/character-rules-fixtures.mjs", "--check"], web)
        run(["node", "node_modules/@playwright/test/cli.js", "test", "--project=ui", "--timeout=90000", "tests/game-mechanics/authoring.spec.js",
             "tests/tutorials/status-mechanics.spec.js", "tests/tutorials/potion-use.spec.js", "tests/tutorials/spell-applications.spec.js",
             "tests/tutorials/application-targets.spec.js", "tests/weapon-charges/weapon-use.spec.js",
             "tests/weapon-charges/luck-blade.spec.js"], web)
    if args.client in ("both", "android"):
        native = ROOT / "native"
        gradle = native / ("gradlew.bat" if os.name == "nt" else "gradlew")
        tests = sorted({name for suite in suites for name in suite["android"]})
        filters = ["--tests", "ru.dndshare.client.mechanics.*"]
        for name in tests:
            root = native / "androidApp/src/test/kotlin"
            matches = list(root.rglob(name + ".kt"))
            if len(matches) != 1:
                raise ValueError(f"Expected one Kotlin suite for {name}, found {matches}")
            package = next(line.split()[1] for line in matches[0].read_text(encoding="utf8").splitlines() if line.startswith("package "))
            filters.extend(["--tests", package + "." + name])
        run([gradle, "--console=plain", ":androidApp:testDebugUnitTest", *filters], native)


if __name__ == "__main__":
    main()
