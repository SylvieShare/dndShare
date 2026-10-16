"""Check complete native mounting surfaces and containment against a receiver."""
import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import sys
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT/'models/collections/majestic-highlands'
spec = importlib.util.spec_from_file_location('frame', Path(__file__).with_name('validate-majestic-frame.py'))
frame = importlib.util.module_from_spec(spec)
spec.loader.exec_module(frame)
DIRECTIONS = [Vector(p).normalized() for p in [(1,.371,.157),(-.283,1,.419),(.217,-.347,1)]]


def inside(tree, point, tolerance=.01, triangles=None):
    if tree.find_nearest(point)[3] <= tolerance:
        return False
    parities = []
    for direction in DIRECTIONS:
        origin = point.copy()
        count = 0
        for _ in range(128):
            hit = tree.ray_cast(origin, direction)
            if hit[0] is None:
                break
            count += 1 if hit[1].dot(direction) > 0 else -1
            origin = hit[0]+direction*.0001
        else:
            raise ValueError('Containment ray did not leave the mesh')
        parities.append(count != 0)
    if len(set(parities)) != 1:
        if triangles is not None:
            # Signed solid angles resolve a ray passing through an STL crack or
            # triangle edge. Overlapping closed shells retain nonzero winding.
            vectors = triangles-np.asarray(tuple(point))
            a,b,c = vectors[:,0],vectors[:,1],vectors[:,2]
            la,lb,lc = [np.linalg.norm(v,axis=1) for v in [a,b,c]]
            numerator = np.einsum('ij,ij->i',a,np.cross(b,c))
            denominator = la*lb*lc+np.einsum('ij,ij->i',a,b)*lc+np.einsum('ij,ij->i',b,c)*la+np.einsum('ij,ij->i',c,a)*lb
            winding = abs(np.arctan2(numerator,denominator).sum()/(2*math.pi))
            if winding < .1:
                return False
            if winding > .9:
                return True
        raise ValueError(f'Ambiguous native mesh containment at {tuple(point)}: {parities}; nearest={tree.find_nearest(point)[3]}')
    return bool(parities[0])


def mounting_mesh(vertices, faces, depth):
    points, polygons = [], []
    for face in faces:
        poly = frame.clip([vertices[i] for i in face], Vector((0,0,1)), -depth+.01)
        if len(poly) < 3:
            continue
        start = len(points)
        points += poly
        polygons.append(tuple(range(start,len(points))))
    return points, polygons


def fit(receiver_vertices, receiver_tree, incoming_vertices, incoming_faces, incoming_tree, depth, elevation, translation, rotation, receiver_triangles=None, incoming_triangles=None):
    angle = math.radians(rotation)
    c,s = math.cos(angle),math.sin(angle)
    zoffset = elevation-depth
    def placed(point):
        x,y,z = point
        return Vector((c*x-s*y+translation[0],s*x+c*y+translation[1],z+zoffset))
    def local(point):
        x,y,z = point-Vector((*translation,zoffset))
        return Vector((c*x+s*y,-s*x+c*y,z))
    vertices = [placed(p) for p in incoming_vertices]
    tree = BVHTree.FromPolygons(vertices,incoming_faces,epsilon=0)
    overlaps = len(receiver_tree.overlap(tree))
    if overlaps:
        raise ValueError(f'{overlaps} native mounting surface intersections')
    # A fully enclosed component has no surface intersections. Check vertices in
    # both directions using the uncut closed meshes; the cut plane is not a cap.
    xyz = np.array([tuple(p) for p in vertices])
    lo,hi = xyz.min(0),xyz.max(0)
    tested = 0
    for point in receiver_vertices:
        if not all(lo[i] < point[i] < hi[i] for i in range(3)):
            continue
        tested += 1
        if inside(incoming_tree,local(point),triangles=incoming_triangles):
            raise ValueError('Receiver vertex inside the native mounting volume')
    receiver_xyz = np.array([tuple(p) for p in receiver_vertices])
    lo,hi = receiver_xyz.min(0),receiver_xyz.max(0)
    # Clipped faces repeat vertices; exact deduplication avoids repeated rays.
    unique = {tuple(p) for p in vertices}
    for values in unique:
        if not all(lo[i] < values[i] < hi[i] for i in range(3)):
            continue
        tested += 1
        if inside(receiver_tree,Vector(values),triangles=receiver_triangles):
            raise ValueError('Native mounting vertex inside the receiver volume')
    return tested


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--code',required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    recipe = json.loads((ROOT/'scripts/maps/majestic-recipes'/f'{args.code}.json').read_text())
    rows = json.loads((BASE/'manifest.json').read_text())
    registry = json.loads((BASE/'registry-snapshot.json').read_text())
    row = next(r for r in rows if r['code']==args.code)
    incoming, references = [], []
    for profile in recipe['frameFit']['profiles']:
        for reference in profile.get('meshReferences',[]):
            code = reference['code']
            native = next(r for r in rows if r['code']==code)
            report = json.loads((BASE/'optimized-review'/code/'report.json').read_text())
            if code == args.code:
                # A new frame must also accept another copy of itself before
                # publication. Its final resources are bound by the proof below.
                own = frame.mesh_fit_assets(native,BASE/'optimized-review'/code)
                if own['source'] != native['sourceSHA256']:
                    raise ValueError(f'{code}: own source differs from inventory')
                live = {'assets':{role:{'sha256':own[role]} for role in ['source','render','lod']}}
            else:
                live = next(r for r in registry if r['id']==report['model']['id'])
                references.append({'id':live['id'],'assets':{role:live['assets'][role]['sha256'] for role in ['source','render','lod']}})
            for tier in ['source','render','lod']:
                actual = ROOT/'models'/native['sourcePath'] if tier=='source' else BASE/'optimized-review'/code/(tier+'.glb')
                if hashlib.sha256(actual.read_bytes()).hexdigest()!=live['assets'][tier]['sha256']:
                    raise ValueError(f'{code}/{tier}: stale reference bytes')
                filename = actual if tier=='source' else BASE/'optimized-review'/code/('preview-model.glb' if tier=='render' else 'lod-preview-model.glb')
                vertices,faces,_ = frame.load(filename,tier=='source')
                if tier=='source':vertices=[p-Vector((*native['mountCenterMM'],0)) for p in vertices]
                full = BVHTree.FromPolygons(vertices,faces,all_triangles=True)
                points,polygons = mounting_mesh(vertices,faces,reference['depthMM'])
                triangles = np.array([tuple(p) for p in vertices])[np.array(faces)]
                incoming.append((code,tier,profile,reference['depthMM'],points,polygons,full,triangles))
    if not incoming:
        raise ValueError('Individually measured mesh references required')
    results = []
    for tier in ['source','render','lod']:
        filename = ROOT/'models'/row['sourcePath'] if tier=='source' else BASE/'optimized-review'/args.code/('preview-model.glb' if tier=='render' else 'lod-preview-model.glb')
        vertices,faces,_ = frame.load(filename,tier=='source')
        if tier!='source':vertices=[p+Vector((*row['mountCenterMM'],0)) for p in vertices]
        tree = BVHTree.FromPolygons(vertices,faces,all_triangles=True)
        receiver_triangles = np.array([tuple(p) for p in vertices])[np.array(faces)]
        for code,reference_tier,profile,depth,points,polygons,full,triangles in incoming:
            for pose in profile['poses']:
                elevation=recipe['supportSlots'][0]['elevation']*35+profile['riseMM']
                try:
                    tested=fit(vertices,tree,points,polygons,full,depth,elevation,pose['translationMM'],pose['rotation'],receiver_triangles,triangles)
                except ValueError as error:
                    raise ValueError(f'{tier}/{code}/{reference_tier}/{pose}: {error}') from error
                results.append({'receiverTier':tier,'referenceCode':code,'referenceTier':reference_tier,'profile':profile['name'],'pose':pose,'containmentPoints':tested,'surfaceIntersections':0})
            print('MOUNT_MESH_FIT_VALIDATED',args.code,tier,code,reference_tier,len(profile['poses']),flush=True)
    p=BASE/'optimized-review'/args.code/'report.json';report=json.loads(p.read_text())
    report['meshFitChecks']=results
    report['meshFitRecipeSHA256']=frame.mesh_fit_contract(recipe)
    report['meshFitAssetSHAs']=frame.mesh_fit_assets(row,p.parent)
    report['meshFitReferences']=references
    report.setdefault('validation',{})['nativeMeshFit']='passed-entire-reference-meshes-intersections-and-bidirectional-containment'
    p.write_text(json.dumps(report,indent=2)+'\n')


if __name__=='__main__':main()
