"""Measured comparison with the bare grass sculpt; avoid a global height cut."""
import json
from pathlib import Path
import bpy
import numpy as np
from mathutils.bvhtree import BVHTree


def sample_field(field, positions):
    uv=np.clip((positions[:,:2]+52.5)*2,0,210)
    lo=np.minimum(uv.astype(int),209); t=uv-lo
    x,y=lo.T; tx,ty=t.T
    return (field[y,x]*(1-tx)*(1-ty)+field[y,x+1]*tx*(1-ty)+
            field[y+1,x]*(1-tx)*ty+field[y+1,x+1]*tx*ty)


def polygon_weight(positions, polygon):
    p=positions[:,:2]; x,y=p.T; inside=np.zeros(len(p),bool); distance=np.full(len(p),np.inf)
    for a,b in zip(polygon,polygon[1:]+polygon[:1]):
        a,b=np.array(a),np.array(b); edge=b-a
        inside^=((a[1]>y)!=(b[1]>y)) & (x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1]+1e-12)+a[0])
        t=np.clip(((p-a)*edge).sum(1)/(edge@edge),0,1)
        distance=np.minimum(distance,np.linalg.norm(p-a-t[:,None]*edge,axis=1))
    return inside*np.clip(distance/2,0,1)


def grass_weights(obj, recipe, code):
    if 'grassReference' not in recipe:
        return np.ones(len(obj.data.vertices),np.float32)
    root=Path(__file__).resolve().parents[2]
    manifest=json.loads((root/'models/collections/majestic-highlands/manifest.json').read_text())
    reference=next(r for r in manifest if r['code']==recipe['grassReference'])
    bpy.ops.wm.stl_import(filepath=str(root/'models'/reference['sourcePath']))
    ref=bpy.context.object
    tree=BVHTree.FromObject(ref,bpy.context.evaluated_depsgraph_get())
    distances=np.array([tree.find_nearest(v.co)[3] for v in obj.data.vertices],np.float32)
    bpy.data.objects.remove(ref,do_unlink=True)
    start=recipe['grassMatchMM']; blend=recipe['grassBlendMM']
    t=np.clip((distances-start)/blend,0,1)
    weights=1-t*t*(3-2*t)
    base=root/'models/collections/majestic-highlands/survey'
    current=np.load(base/code/'top-surface.npy')[:,:,0]
    original=np.load(base/recipe['grassReference']/'top-surface.npy')[:,:,0]
    loss=np.where((current>0)&(original>0),np.maximum(0,original-current),0)
    padded=np.pad(loss,1,mode='edge')
    loss=sum(padded[y:y+211,x:x+211] for y in range(3) for x in range(3))/9
    xyz=np.empty(len(obj.data.vertices)*3,np.float32)
    obj.data.vertices.foreach_get('co',xyz)
    loss=sample_field(loss,xyz.reshape(-1,3))
    covered=np.clip((loss-recipe['grassCoverLossMM'])/recipe['grassCoverFadeMM'],0,1)
    weights*=1-covered*covered*(3-2*covered)
    positions=xyz.reshape(-1,3)
    if recipe.get('soilDomains'):
        domain=np.maximum.reduce([polygon_weight(positions,p) for p in recipe['soilDomains']])
        height=np.clip((positions[:,2]-recipe['soilSurfaceMM'])/recipe['grassHeightFadeMM'],0,1)
        height=height*height*(3-2*height)
        weights*=1-domain*(1-height)
    print('GRASS_REFERENCE',len(distances),np.quantile(distances,[0,.25,.5,.75,.9,1]).tolist(),float(weights.mean()),flush=True)
    return weights
