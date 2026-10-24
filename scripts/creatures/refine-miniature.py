#!/usr/bin/env python3
"""Integrate observed normals while anchoring the original calibrated silhouette."""
import argparse
import json
from pathlib import Path

import numpy as np
import trimesh
from scipy import sparse
from scipy.sparse.linalg import cg
from trellis_views import extract_views, depth_maps, project, sample
from multiview_texture import project_views


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source',type=Path)
    parser.add_argument('output',type=Path)
    args=parser.parse_args();args.output.mkdir(parents=True,exist_ok=True)
    data=np.load(args.source/'reconstructed-hull.npz')
    original=trimesh.Trimesh(data['vertices'],data['faces'],process=False)
    mesh=original.simplify_quadric_decimation(face_count=160000,aggression=3)
    views=extract_views(args.source);depths=depth_maps(original)
    start=mesh.vertices.copy();vertices=start.copy()
    edges=mesh.edges_unique;i,j=edges.T
    count=len(vertices)
    degree=np.bincount(edges.ravel(),minlength=count)
    silhouette=np.zeros(count)
    for k,view in enumerate(views):
        uv,z=project(vertices,k)
        visible=z<=sample(depths[k],(uv+.5)/2-.5)+.012
        sdf=sample(view['sdf'],uv)
        silhouette=np.maximum(silhouette,visible*(sdf<2.5)*(sdf>-.5))
    anchors=.025*degree+silhouette*degree*4
    lap=sparse.coo_matrix((np.concatenate([np.ones(len(i)),np.ones(len(i)),degree+anchors]),
        (np.concatenate([i,j,np.arange(count)]),np.concatenate([j,i,np.arange(count)]))),shape=(count,count)).tocsr()
    # Off-diagonal terms of the graph Laplacian are negative.
    lap=sparse.diags(2*(degree+anchors))-lap
    inverse=sparse.diags(1/(degree+anchors))
    changes=[]
    for step in range(5):
        current=trimesh.Trimesh(vertices,mesh.faces,process=False)
        _,observed=project_views(vertices,current.vertex_normals,views,depths)
        target=observed+current.vertex_normals*.15
        target/=np.maximum(1e-8,np.linalg.norm(target,axis=1,keepdims=True))
        normals=target[i]+target[j]
        normals/=np.maximum(1e-8,np.linalg.norm(normals,axis=1,keepdims=True))
        delta=vertices[j]-vertices[i]
        tangent=delta-normals*np.sum(delta*normals,axis=1,keepdims=True)
        tangent*=np.minimum(1.25,np.linalg.norm(start[j]-start[i],axis=1)/np.maximum(1e-8,np.linalg.norm(tangent,axis=1)))[:,None]
        rhs=anchors[:,None]*start
        np.add.at(rhs,i,-tangent);np.add.at(rhs,j,tangent)
        refined=np.column_stack([cg(lap,rhs[:,axis],x0=vertices[:,axis],M=inverse,rtol=1e-7,maxiter=250)[0] for axis in range(3)])
        offset=refined-start;length=np.linalg.norm(offset,axis=1)
        refined=start+offset*np.minimum(1,.012/np.maximum(length,1e-8))[:,None]
        changes.append(float(np.mean(np.linalg.norm(refined-vertices,axis=1))))
        vertices=refined
        print(f'Normal integration {step+1}/5 mean movement {changes[-1]:.6f}',flush=True)
    result=trimesh.Trimesh(vertices,mesh.faces,process=False)
    np.savez_compressed(args.output/'reconstructed-hull.npz',vertices=result.vertices.astype('f4'),faces=result.faces.astype('i4'))
    result.export(args.output/'refined-hull.ply')
    info={'source':'previous calibrated 8-view hull','method':'anchored normal integration',
          'triangles':len(result.faces),'watertight':result.is_watertight,
          'maxDisplacement':float(np.max(np.linalg.norm(vertices-start,axis=1))),
          'iterationMeanDisplacements':changes}
    (args.output/'refinement.json').write_text(json.dumps(info,indent=2)+'\n')
    print(json.dumps(info),flush=True)


if __name__=='__main__':main()
