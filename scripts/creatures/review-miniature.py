#!/usr/bin/env python3
"""Inspect a current review context, or record an operator's visual acceptance."""
import argparse
import json
from pathlib import Path
from miniature_review import review_context
from model_build_queue import fingerprint
from trellis_checkpoint import write_json

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('directory',type=Path)
parser.add_argument('recipe',type=Path)
parser.add_argument('--approve',action='store_true',help='Only after visually inspecting the current views and placement')
parser.add_argument('--notes-file',type=Path,help='UTF-8 observations, one per line; required for approval')
args=parser.parse_args()
recipe=json.loads(args.recipe.read_text())
context=review_context(args.directory,recipe,recipe['build']['size'])
if not args.approve:
    print(json.dumps({'contextSHA256':fingerprint(context),'context':context},ensure_ascii=False,indent=2))
else:
    if not args.notes_file:parser.error('--approve requires --notes-file with actual visual observations')
    notes=[line.strip() for line in args.notes_file.read_text().splitlines() if line.strip()]
    if not notes:parser.error('Visual observations must not be empty')
    path=args.directory/'model-review.json'
    write_json(path,{'schema':2,'approved':True,'context':context,'contextSHA256':fingerprint(context),'notes':notes})
    print(json.dumps({'approved':True,'review':str(path),'contextSHA256':fingerprint(context)}))
