"""Prepare diagnostic candidates for one model; publication requires visual QA."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT/'models/collections/medieval-town-vol1'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('code')
    parser.add_argument('--force', action='store_true')
    parser.add_argument('--textures-only', action='store_true', help='Repack unchanged prepared geometry; recipe equality is still required')
    args = parser.parse_args()
    blender = os.environ.get('BLENDER', '/Applications/Blender.app/Contents/MacOS/Blender')
    script = ROOT/'scripts/maps'
    code = args.code
    index = json.loads((script/'medieval-recipes.json').read_text())
    if code not in index:
        raise ValueError('Individually measured recipe required')
    stages = []
    for tier in ([] if args.textures_only else ['render', 'lod']):
        cmd = [blender, '--background', '--python-exit-code', '1', '--python', str(script/'prepare-medieval.py'),
               '--', '--code', code, '--tier', tier]+(['--force'] if args.force else [])
        stages.append((tier, cmd))
    for candidate in [None, 'compact']:
        label = candidate or 'balanced'
        cmd = ['node', str(script/'package-medieval.mjs'), '--code='+code]+(['--candidate='+candidate] if candidate else [])
        stages.append(('package-'+label, cmd))
        review = BASE/'review'/code/'candidates' if candidate else BASE/'review'
        for tier in ['render', 'lod']:
            cmd = [blender, '--background', '--python-exit-code', '1', '--python', str(script/'preview-model-revisions.py'),
                   '--', '--base', str(review), '--size', '512', '--review', '--front', '--tier', tier]
            cmd += ['--codes', candidate or code]
            stages.append(('preview-'+label+'-'+tier, cmd))
        recipe = json.loads((script/index[code]).read_text())
        if any(part.get('kind')=='liquid' for part in recipe['materials'].get('surfaceParts', [])):
            cmd = [blender,'--background','--python-exit-code','1','--python',str(script/'validate-medieval-liquids.py'),
                   '--','--code',code]+(['--candidate','compact'] if candidate else [])
            stages.append(('liquid-pixels-'+label,cmd))
    stages.append(('comparison', ['node', str(script/'review-medieval-sheet.mjs'), code]))
    for stage, cmd in stages:
        log = BASE/(code+'-'+stage+'.log')
        with log.open('w') as output:
            result = subprocess.run(cmd, cwd=ROOT, stdout=output, stderr=subprocess.STDOUT)
        if result.returncode:
            print(log.read_text()[-5000:], file=sys.stderr)
            raise RuntimeError(stage+' failed')
        print('MEDIEVAL_REVIEW_STAGE', code, stage, flush=True)
    print('MEDIEVAL_VISUAL_REVIEW_REQUIRED', code, flush=True)


if __name__ == '__main__': main()
