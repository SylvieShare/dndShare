"""Prove a DB pin envelope contains the complete native and final mounting meshes."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT/'models/collections/majestic-highlands'
spec = importlib.util.spec_from_file_location('frame', Path(__file__).with_name('validate-majestic-frame.py'))
frame = importlib.util.module_from_spec(spec)
spec.loader.exec_module(frame)


def enclosing_error(vertices, faces, profile):
    centres = sorted(profile['pinCentresMM'], key=lambda p: p[1])
    if any(x != 0 for x, _ in centres):
        raise ValueError('The reference pin rows must share X=0')
    depth = profile['depthMM']
    maximum, tested = 0, 0
    for face in faces:
        points = [vertices[i] for i in face]
        if min(p.z for p in points) > depth or max(p.z for p in points) < 0:
            continue
        for (z0, r0), (z1, r1) in zip(profile['sectionsMM'], profile['sectionsMM'][1:]):
            if min(p.z for p in points) > z1 or max(p.z for p in points) < z0:
                continue
            slab = frame.clip(frame.clip(points, Vector((0,0,-1)), z0), Vector((0,0,1)), -z1)
            for index, (cx, cy) in enumerate(centres):
                polygon = slab
                if index+1 < len(centres):
                    midpoint = (cy+centres[index+1][1])/2
                    polygon = frame.clip(polygon, Vector((0,1,0)), -midpoint)
                if index:
                    midpoint = (cy+centres[index-1][1])/2
                    polygon = frame.clip(polygon, Vector((0,-1,0)), midpoint)
                for point in polygon:
                    radius = r0+(r1-r0)*(point.z-z0)/(z1-z0)
                    actual = max(abs(point.x-cx), abs(point.y-cy))
                    maximum = max(maximum, actual-radius)
                    tested += 1
    if not tested:
        raise ValueError('No mounting triangles checked')
    return maximum, tested


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--code', required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    index = json.loads((ROOT/'scripts/maps/majestic-recipes.json').read_text())
    recipe = json.loads((ROOT/'scripts/maps'/index[args.code]).read_text())
    profile = next(p for p in recipe['frameFit']['profiles'] if p['name'] == 'db-pins')
    rows = json.loads((BASE/'manifest.json').read_text())
    registry = json.loads((BASE/'registry-snapshot.json').read_text())
    result = []
    for code in profile['referenceModels']:
        row = next(r for r in rows if r['code'] == code)
        directory = BASE/'optimized-review'/code
        report = json.loads((directory/'report.json').read_text())
        live = next(r for r in registry if r['id'] == report['model']['id'])
        for role in ['source', 'render', 'lod']:
            if live['assets'][role]['sha256'] != report['model']['assets'][role]['sha256']:
                raise ValueError(f'{code}: local reference differs from current registry')
            filename = ROOT/'models'/row['sourcePath'] if role == 'source' else directory/(role+'.glb')
            if hashlib.sha256(filename.read_bytes()).hexdigest() != live['assets'][role]['sha256']:
                raise ValueError(f'{code}/{role}: reference bytes differ from current registry')
        for tier in ['source', 'render', 'lod']:
            path = ROOT/'models'/row['sourcePath'] if tier == 'source' else directory/('preview-model.glb' if tier == 'render' else 'lod-preview-model.glb')
            vertices, faces, _ = frame.load(path, tier == 'source')
            if tier == 'source':
                shift = Vector((*row['mountCenterMM'], 0))
                vertices = [p-shift for p in vertices]
            error, tested = enclosing_error(vertices, faces, profile)
            if error > .001:
                raise ValueError(f'{code}/{tier}: reference escapes envelope by {error}mm')
            result.append({'code': code, 'tier': tier, 'pointsTested': tested, 'maxOutsideMM': error})
            print('MOUNT_ENVELOPE_VALIDATED', code, tier, tested, error, flush=True)
    path = BASE/'optimized-review'/args.code/'report.json'
    report = json.loads(path.read_text())
    report['mountEnvelopeChecks'] = result
    report.setdefault('validation', {})['nativeDBEnvelope'] = 'passed-entire-reference-mounts-source-render-lod'
    path.write_text(json.dumps(report, indent=2)+'\n')


if __name__ == '__main__':
    main()
