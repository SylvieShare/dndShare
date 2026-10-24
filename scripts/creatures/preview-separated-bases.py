"""Render separated model previews. Run with Blender --background --python ... -- DIRECTORY."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import miniature_scene as scene

directory = Path(sys.argv[sys.argv.index('--') + 1])
models = json.loads((directory / 'publish/catalogue.json').read_text())
for model in models:
    target = directory / model['id']
    target.mkdir(exist_ok=True)
    scene.import_glb(directory / f"{model['id']}-preview.glb")
    scene.render(target, [('preview', 254, 25)], resolution=384)
