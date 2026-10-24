#!/usr/bin/env python3
"""Check the exact bundle's placement and visual acceptance before packaging."""
import argparse
import json
from pathlib import Path
from miniature_review import require_review

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('directory',type=Path)
parser.add_argument('recipe',type=Path)
args=parser.parse_args()
recipe=json.loads(args.recipe.read_text())
require_review(args.directory,recipe,recipe['build']['size'],args.directory/'model-review.json')
print('Current assets, scale, base and placement are reviewed')
