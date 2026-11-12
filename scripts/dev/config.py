"""One local configuration on C:; installed tools stay where they already are."""
from pathlib import Path
import platform
import re

from . import windows
from .common import UIError, capture, read_json, write_json
from .dependencies import browser_libraries, choose_modules, environment


def primary_root(source):
    marker=source/'.git'
    if marker.is_file():
        value=marker.read_text(encoding='utf8').removeprefix('gitdir:').strip().replace('\\','/')
        if re.match(r'^[A-Za-z]:/',value):value='/mnt/'+value[0].lower()+value[2:]
        for parent in Path(value).parents:
            if parent.name=='.git':return parent.parent
        return Path(capture(['git','rev-parse','--path-format=absolute','--git-common-dir'],cwd=source)).parent
    return source


def current_tools(config,source):
    version_file=source/'.node-version'
    if not version_file.is_file():return config
    primary=primary_root(source)
    version=version_file.read_text(encoding='utf8').strip()
    go_version=re.search(r'^go\s+([0-9.]+)',(source/'go.mod').read_text(),re.MULTILINE).group(1)
    config.update(node=f'/mnt/c/Tools/NodeJS/node-v{version}-linux-x64/bin/node',node_version=version,
                  go=f'/mnt/c/Tools/Go/go{go_version}-linux-amd64/go/bin/go',
                  go_path='/mnt/c/Tools/Go/cache',go_cache='/mnt/c/Tools/Go/build-cache',
                  modules_cache=str(primary/'build/linux-node-cache'),
                  playwright_cache=str(primary/'build/dev-tools/playwright-cache'))
    config['node_modules']=str(choose_modules(source,config['node'],environment(config)))
    return config


def load(source):
    if platform.system() != "Linux" or not str(source).lower().startswith("/mnt/c/"):
        raise UIError("Run in Linux/WSL with the checkout on C: (/mnt/c/...)")
    location = source / "build/dev-tools/local-tools.json"
    if location.exists():
        config = read_json(location)
        if config.get("schema") != 1 or Path(config["source"]).resolve() != source:
            raise UIError(f"Invalid local tool configuration: {location}")
        return current_tools(config,source)
    if (source / '.git').is_file():
        primary = primary_root(source)
        shared = primary / 'build/dev-tools/local-tools.json'
        if shared.is_file():
            inherited = read_json(shared)
            if inherited.get('schema') == 1 and Path(inherited['source']).resolve() == primary:
                config = dict(inherited, source=str(source))
                write_json(location, config)
                return current_tools(config,source)
    primary=primary_root(source)
    tools = primary / "build/header-linux-tools"
    pg = primary / "build/native-setup/pg-runtime/usr"
    node_version=(source/'.node-version').read_text(encoding='utf8').strip()
    config = {"schema": 1, "source": str(source),
              "node": f'/mnt/c/Tools/NodeJS/node-v{node_version}-linux-x64/bin/node',
              "node_version": node_version, "go": str(tools / "go/bin/go"),
              "go_cache": str(tools / "go-cache"), "go_path": str(tools / "go-path"),
              "pg_bin": str(pg / "lib/postgresql/16/bin"),
              "library_paths": [str(browser_libraries(primary)), str(pg / "lib/x86_64-linux-gnu")],
              "playwright_cache": str(tools / "playwright-cache")}
    config.update(windows.discover())
    config=current_tools(config,source)
    write_json(location, config)
    return config
