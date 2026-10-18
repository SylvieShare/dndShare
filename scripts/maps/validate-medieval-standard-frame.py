import bpy,json,hashlib,numpy as np,sys,gc
from pathlib import Path
from mathutils.bvhtree import BVHTree
b=Path(__file__).resolve().parents[2]/'models/collections/medieval-town-vol1';inventory=json.loads((b/'inventory.json').read_text());codes=sys.argv[sys.argv.index('--')+1:]if '--'in sys.argv else [v['code']for v in inventory if int(v['code'][4:])>=700];rows=[];D=5.373095;t=17.5;bot=12.98;k=(t-bot)/D
def collision(tri,seat):
 zlo=seat-D;a=bot-k*zlo;normals=np.array([[1,0,-k],[-1,0,-k],[0,1,-k],[0,-1,-k],[0,0,-1],[0,0,1]],float);bounds=np.array([a,a,a,a,-zlo,seat])-.005*np.linalg.norm(normals,axis=1)
 distances=tri@normals.T-bounds;candidate=~np.any(np.all(distances>0,axis=1),axis=1)
 for T in tri[candidate]:
  polygon=list(T)
  for N,B in zip(normals,bounds):
   clipped=[]
   for A,C in zip(polygon,polygon[1:]+polygon[:1]):
    aa,cc=float(A@N-B),float(C@N-B)
    if aa<=0:clipped.append(A)
    if (aa<=0)!=(cc<=0):clipped.append(A+(C-A)*aa/(aa-cc))
   polygon=clipped
   if len(polygon)<3:break
  if len(polygon)>=3 and any(np.linalg.norm(np.cross(polygon[i]-polygon[0],polygon[i+1]-polygon[0]))>1e-12 for i in range(1,len(polygon)-1)):return True
 return False
for code in codes:
 r=next(v for v in inventory if v['code']==code);path=b.parents[1]/r['sourcePath'];assert hashlib.sha256(path.read_bytes()).hexdigest()==r['sourceSHA256'];bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.wm.stl_import(filepath=str(path));obj=bpy.context.object;tree=BVHTree.FromObject(obj,bpy.context.evaluated_depsgraph_get());p=np.array([v.co[:]for v in obj.data.vertices]);indices=np.array([f.vertices[:]for f in obj.data.polygons]);tri=p[indices];low=tri.min(1);high=tri.max(1);W=round((r['max'][0]-r['min'][0])/35);H=round((r['max'][1]-r['min'][1])/35);slots=[]
 for iy in range(H):
  for ix in range(W):
   cx,cy=(ix-(W-1)/2)*35,(iy-(H-1)/2)*35;mask=(high[:,0]>=cx-t)&(low[:,0]<=cx+t)&(high[:,1]>=cy-t)&(low[:,1]<=cy+t);q=tri[mask].copy();q[:,:,:2]-=[cx,cy];points=q.reshape(-1,3)
   def score(a):
    good=(abs(a[:,0])<=t+1e-8)&(abs(a[:,1])<=t+1e-8);a=a[good]
    if not len(a):return(-np.inf,None)
    f=a[:,2]+D-np.maximum(0,(np.max(abs(a[:,:2]),axis=1)-bot)/k);i=f.argmax();return(float(f[i]),a[i].tolist())
   best,contact=score(points)
   A=q.reshape(-1,3);B=q[:,[1,2,0]].reshape(-1,3)
   # Break lines of the piecewise-linear frustum support function and the cell boundary.
   for nx,ny,c in [(1,0,bot),(1,0,-bot),(0,1,bot),(0,1,-bot),(1,-1,0),(1,1,0),(1,0,t),(1,0,-t),(0,1,t),(0,1,-t)]:
    aa=A[:,0]*nx+A[:,1]*ny-c;bb=B[:,0]*nx+B[:,1]*ny-c;valid=(aa*bb<0);u=aa[valid]/(aa[valid]-bb[valid]);v=A[valid]+(B[valid]-A[valid])*u[:,None];s,P=score(v)
    if s>best:best,contact=s,P
   # Interior vertices of the planar partition; highest intersection suffices because F increases with Z.
   for radius in [bot,t]:
    for x,y in [(radius,radius),(-radius,radius),(radius,-radius),(-radius,-radius)]:
     hit=tree.ray_cast((cx+x,cy+y,r['max'][2]+1),(0,0,-1))
     if hit[0]is not None:
      P=np.array([[x,y,hit[0].z]]);s,P=score(P)
      if s>best:best,contact=s,P
   seat=best+.02;assert not collision(q,seat),(code,ix,iy,'native triangle intersects verified frustum');rise=max(0,seat-r['max'][2]);assert rise/35<=.15,(code,ix,iy,rise);slots.append(dict(x=ix,y=iy,centerMM=[cx,cy],limitingContactLocalMM=contact,minimumSeatMM=best,verifiedSeatMM=seat,frameTopMM=r['max'][2],insertionRiseMM=rise,independentTriangleClippingPassed=True))
 out={'code':code,'sourceSHA256':r['sourceSHA256'],'triangles':len(tri),'depthMM':D,'topWidthMM':35,'bottomWidthMM':25.96,'method':'Exact maximum of piecewise-linear frustum support function over every native triangle: vertices,edge/break-line intersections,and interior partition corners;20um clearance','slots':slots};rows.append(out);print('NATIVE_STANDARD_FIT',code,len(slots),'maxRiseMM',max(s['insertionRiseMM']for s in slots),flush=True);del tree,tri,p,indices,low,high;gc.collect()
(b/'mount-standard-native-frame-fit.json').write_text(json.dumps(rows,indent=2)+'\n')
