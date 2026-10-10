"""Measure one source tile and render its sculpt without changing the STL."""
import argparse
import json
from pathlib import Path
import sys
import bpy
import numpy as np
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT/'models/collections/majestic-highlands'
sys.path.insert(0, str(Path(__file__).resolve().parent))
from tile_mesh import activate, shade


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--code', required=True)
    parser.add_argument('--field-code', help='Write only a named auxiliary height field in survey/')
    parser.add_argument('--field-bounds-mm', type=float, nargs=4, metavar=('MIN_X', 'MIN_Y', 'MAX_X', 'MAX_Y'))
    parser.add_argument('--field-ray-start-mm', type=float, default=1000)
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    bounds = args.field_bounds_mm or [-52.5, -52.5, 52.5, 52.5]
    if not np.isfinite(bounds).all() or bounds[2] <= bounds[0] or bounds[3] <= bounds[1]:
        parser.error('Height field bounds must be finite increasing XY corners')
    if args.field_code is not None and (not args.field_code or Path(args.field_code).name != args.field_code or args.field_code in ['.', '..']):
        parser.error('Field code must be a single directory name')
    row = next(r for r in json.loads((BASE/'manifest.json').read_text()) if r['code']==args.code)
    if not np.isfinite(args.field_ray_start_mm) or args.field_ray_start_mm <= row['max'][2]:
        parser.error('Height field rays must start above the complete source model')
    out = BASE/'survey'/(args.field_code or args.code); out.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.wm.stl_import(filepath=str(ROOT/'models'/row['sourcePath']))
    obj = bpy.context.object; shade(obj)
    coords = np.empty(len(obj.data.vertices)*3,np.float32)
    obj.data.vertices.foreach_get('co',coords); coords=coords.reshape(-1,3)
    obj.data.calc_loop_triangles()
    triangles = coords[np.array([list(t.vertices) for t in obj.data.loop_triangles])]
    sections = {}
    for plane in [.1,2,5,9,9.5,9.75,10,10.2,11,12,14,15,16]:
        cross=triangles[(triangles[:,:,2].min(1)<plane)&(triangles[:,:,2].max(1)>plane)]
        points=[]
        for i,j in [(0,1),(1,2),(2,0)]:
            a,b=cross[:,i],cross[:,j];mask=(a[:,2]<plane)!=(b[:,2]<plane)
            a,b=a[mask],b[mask]
            if len(a): points.append(a+(b-a)*((plane-a[:,2])/(b[:,2]-a[:,2]))[:,None])
        if points:
            points=np.concatenate(points); low,high=points.min(0),points.max(0)
            sections[str(plane)]={'low':low.tolist(),'high':high.tolist(),'span':(high-low).tolist()}
    tree=BVHTree.FromObject(obj,bpy.context.evaluated_depsgraph_get())
    grid=np.zeros((211,211,4),np.float32)
    for yi,y in enumerate(np.linspace(bounds[1],bounds[3],211)):
        for xi,x in enumerate(np.linspace(bounds[0],bounds[2],211)):
            p,n,_,_=tree.ray_cast((x,y,args.field_ray_start_mm),(0,0,-1))
            if p: grid[yi,xi]=[p.z,*n]
    np.save(out/'top-surface.npy',grid)
    if args.field_code:
        metadata = {'sourceCode': args.code, 'sourceSHA256': row['sourceSHA256'],
                    'fieldBoundsMM': [bounds[:2], bounds[2:]], 'resolution': [211, 211],
                    'rayStartMM': args.field_ray_start_mm}
        (out/'height-field.json').write_text(json.dumps(metadata, indent=2)+'\n')
        print('MAJESTIC_HEIGHT_FIELD', args.field_code, metadata, flush=True)
        return
    report={'source':row,'sections':sections,'topQuantiles':np.quantile(grid[:,:,0],[0,.1,.25,.5,.75,.9,1]).tolist()}
    (out/'survey.json').write_text(json.dumps(report,indent=2)+'\n')
    print('MAJESTIC_SURVEY',args.code,report['sections'],report['topQuantiles'],flush=True)
    for v in obj.data.vertices: v.co/=35
    mat=bpy.data.materials.new('Neutral source');mat.use_nodes=True
    mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.38,.38,.38,1)
    obj.data.materials.append(mat);activate(obj)
    bpy.ops.export_scene.gltf(filepath=str(out/'preview-model.glb'),export_format='GLB',use_selection=True,export_animations=False)
    (out/'report.json').write_text(json.dumps({'model':{'sourceCode':args.code,'placementOffset':[0,0],'mountDepth':9.75/35}},indent=2)+'\n')


if __name__=='__main__': main()
