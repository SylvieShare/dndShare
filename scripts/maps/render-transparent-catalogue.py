"""Render a bounded, resumable batch from prepared copies of published models."""
import argparse
import importlib.util
import json
from pathlib import Path
import sys

spec = importlib.util.spec_from_file_location('model_preview', Path(__file__).with_name('preview-model-revisions.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
parser = argparse.ArgumentParser()
parser.add_argument('--base', type=Path, required=True)
parser.add_argument('--start', type=int, default=0)
parser.add_argument('--count', type=int, default=20)
parser.add_argument('--codes', nargs='*')
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
entries = [e for e in json.loads((args.base/'inventory.json').read_text()) if not e['transparent']]
if args.codes:
    entries = [e for e in entries if e['model']['sourceCode'] in args.codes]
for entry in entries[args.start:args.start+args.count]:
    m = entry['model']
    directory = args.base/'prepared'/m['id']
    # Look towards the free side of edge walls, accounting for game Y vs Blender Y.
    vertices = [v for contour in m['blockers'] for v in contour]
    front = False
    inside = False
    if vertices and (m['tileType'].startswith('wall') or m['tileType'] == 'passage'):
        dx = sum(v[0] for v in vertices)/len(vertices)-m['width']/2
        dy = sum(v[1] for v in vertices)/len(vertices)-m['height']/2
        front = dy > .04
        inside = dy <= .04 and dx > .04
    module.preview(directory/'report.json', size=entry['width'] or 512, front=front,
                   inside=inside, transparent=True)
    print('CATALOGUE_PREVIEW', m['collection'], m['sourceCode'], m['id'], flush=True)
