"""Measure the bare UD-014 corner floor to separate low UD-013 bones from stone."""
import argparse
import json
from pathlib import Path
import numpy as np

ROOT=Path(__file__).resolve().parents[2]
rows=json.loads((ROOT/'models/collections/manifest.json').read_text())
parser=argparse.ArgumentParser()
parser.add_argument('--code',default='UD-014')
parser.add_argument('--out',default='models/collections/ud013-floor.json')
args=parser.parse_args()
row=next(r for r in rows if r['collection']=='ultimate-dungeon' and r['code']==args.code)
dtype=np.dtype([('normal','<f4',(3,)),('v','<f4',(3,3)),('a','<u2')])
triangles=np.memmap(ROOT/'models'/row['sourcePath'],dtype=dtype,mode='r',offset=84,shape=(row['triangles'],))['v'].copy()
triangles[:,:,2]-=row['cutHeight']
triangles=triangles[triangles[:,:,2].max(1)<18]
step=.1; size=351; heights=np.full((size,size),-np.inf,np.float32)
for triangle in triangles:
    xy=(triangle[:,:2]+17.5)/step
    a,b,c=xy;den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
    if abs(den)<1e-7:continue
    low=np.maximum(0,np.floor(xy.min(0)).astype(int));high=np.minimum(size-1,np.ceil(xy.max(0)).astype(int))
    if np.any(low>high):continue
    xx,yy=np.meshgrid(np.arange(low[0],high[0]+1),np.arange(low[1],high[1]+1))
    wa=((b[1]-c[1])*(xx-c[0])+(c[0]-b[0])*(yy-c[1]))/den
    wb=((c[1]-a[1])*(xx-c[0])+(a[0]-c[0])*(yy-c[1]))/den;wc=1-wa-wb
    mask=(wa>=-.001)&(wb>=-.001)&(wc>=-.001)
    z=wa*triangle[0,2]+wb*triangle[1,2]+wc*triangle[2,2]
    target=heights[low[1]:high[1]+1,low[0]:high[0]+1]
    np.maximum(target,np.where(mask,z,-np.inf),out=target)
heights[~np.isfinite(heights)]=13.7
heights[heights<12.8]=13.7
out=ROOT/args.out
out.write_text(json.dumps({'step':step,'size':size,'min':-17.5,'sourceSHA256':row['sourceSHA256'],'heights':np.round(heights,3).reshape(-1).tolist()})+'\n')
print('Measured bare corner floor',size,step,float(heights.min()),float(heights.max()))
