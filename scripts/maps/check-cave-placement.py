"""Compare actual standable surfaces before and after a Lost Cave rebuild."""
import argparse
import json
from pathlib import Path
import sys
import bpy
from mathutils import Vector


def heights(file, model):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(file))
    graph = bpy.context.evaluated_depsgraph_get()
    result = []
    for p in model['placementPoints']:
        origin = Vector((p['x']-model['width']/2-model['placementOffset'][0],
                         model['height']/2-p['y']+model['placementOffset'][1],
                         model['maxHeight']+2))
        hit = bpy.context.scene.ray_cast(graph, origin, Vector((0,0,-1)))
        if not hit[0] or hit[2].z <= 0:
            raise ValueError('Placement point has no upper surface')
        result.append(hit[1].z)
    return result


parser = argparse.ArgumentParser()
parser.add_argument('--report', type=Path, required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
report = json.loads(args.report.read_text())
directory = args.report.parent
checks = {}
for tier in ['render','lod']:
    before = heights(directory/(tier+'-input.glb'),report['model'])
    after = heights(directory/('preview-model.glb' if tier=='render' else 'lod-preview-model.glb'),report['model'])
    drift = max((abs(a-b) for a,b in zip(before,after)),default=0)
    if drift > .03:
        raise ValueError('Existing placement surface changed by more than1.05 mm')
    checks[tier] = {'points':len(before),'maxDriftMM':drift*35,'before':before,'after':after}
report['placementChecks'] = checks
args.report.write_text(json.dumps(report,indent=2)+'\n')
print('CAVE_PLACEMENT',checks,flush=True)
