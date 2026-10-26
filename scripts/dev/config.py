"""One local configuration on C:; installed tools stay where they already are."""
from pathlib import Path
import platform

from . import windows
from .common import UIError, read_json, write_json
from .dependencies import browser_libraries, choose_modules, environment


def load(source):
    if platform.system() != "Linux" or not str(source).lower().startswith("/mnt/c/"):
        raise UIError("Run in Linux/WSL with the checkout on C: (/mnt/c/...)")
    location = source / "build/dev-tools/local-tools.json"
    if location.exists():
        config = read_json(location)
        if config.get("schema") != 1 or Path(config["source"]).resolve() != source:
            raise UIError(f"Invalid local tool configuration: {location}")
        return config
    tools = source / "build/header-linux-tools"
    pg = source / "build/native-setup/pg-runtime/usr"
    config = {"schema": 1, "source": str(source),
              "node": str(tools / "node-v20.20.2-linux-x64/bin/node"),
              "node_version": "20.20.2", "go": str(tools / "go/bin/go"),
              "go_cache": str(tools / "go-cache"), "go_path": str(tools / "go-path"),
              "pg_bin": str(pg / "lib/postgresql/16/bin"),
              "library_paths": [str(browser_libraries(source)), str(pg / "lib/x86_64-linux-gnu")],
              "playwright_cache": str(tools / "playwright-cache")}
    config.update(windows.discover())
    config["node_modules"] = str(choose_modules(source, config["node"], environment(config)))
    write_json(location, config)
    return config
