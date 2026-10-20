#!/usr/bin/env bash
set -euo pipefail
root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
runtime_dir="$root_dir/models/.map-model-tools-runtime"
link_dir=/private/tmp/dndshare-model-tools
packages=(
  @gltf-transform/core@4.5.1 @gltf-transform/extensions@4.5.1
  @gltf-transform/functions@4.5.1 meshoptimizer@1.3.0 sharp@0.35.5
  three@0.186.1 three-mesh-bvh@0.9.16
)
mkdir -p "$runtime_dir"
npm install --prefix "$runtime_dir" --save-exact --prefer-offline --no-audit --no-fund \
  --cache "${MAP_MODEL_NPM_CACHE:-/private/tmp/dndshare-npm-cache}" "${packages[@]}"
python3 - "$runtime_dir" "$link_dir" <<'PY'
from pathlib import Path
from datetime import datetime
import sys
runtime, link = map(Path, sys.argv[1:])
if link.is_symlink() and link.resolve() == runtime.resolve():
    raise SystemExit(0)
if link.exists() or link.is_symlink():
    backup = link.with_name(link.name + '.replaced.' + datetime.now().strftime('%Y%m%d%H%M%S%f'))
    link.rename(backup)
    print('Previous temporary runtime preserved at', backup)
link.symlink_to(runtime, target_is_directory=True)
print('Model tools linked to persistent ignored workspace runtime')
PY
node -e 'const r=require("node:module").createRequire(process.argv[1]); for(const p of ["@gltf-transform/core","@gltf-transform/extensions","@gltf-transform/functions","meshoptimizer","sharp","three","three-mesh-bvh"]) r(p); console.log("MODEL_TOOLS_READY")' "$link_dir/package.json"
