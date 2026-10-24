"""UV rasterization and calibrated multiview albedo/normal projection."""
import numpy as np
from trellis_views import camera, project, sample


def rasterize(vertices, faces, uv, normals, size):
    positions=np.zeros((size,size,3),dtype=np.float32)
    directions=np.zeros_like(positions)
    ids=np.full((size,size),-1,dtype=np.int32)
    pixels=uv*np.array([size,-size])+[0,size]
    for index,face in enumerate(faces):
        a,b,c=pixels[face];e1=b-a;e2=c-a
        det=e1[0]*e2[1]-e1[1]*e2[0]
        if abs(det)<1e-8:continue
        low=np.maximum(0,np.floor(np.min(pixels[face],axis=0)).astype(int))
        high=np.minimum(size-1,np.ceil(np.max(pixels[face],axis=0)).astype(int))
        if np.any(high<low):continue
        yy,xx=np.mgrid[low[1]:high[1]+1,low[0]:high[0]+1]
        delta=np.stack([xx+.5-a[0],yy+.5-a[1]],axis=-1)
        u=(delta[...,0]*e2[1]-delta[...,1]*e2[0])/det
        v=(e1[0]*delta[...,1]-e1[1]*delta[...,0])/det
        mask=(u>=0)&(v>=0)&(u+v<=1)
        if not np.any(mask):continue
        x=xx[mask];y=yy[mask];u=u[mask,None];v=v[mask,None]
        positions[y,x]=vertices[face[0]]*(1-u-v)+vertices[face[1]]*u+vertices[face[2]]*v
        directions[y,x]=normals[face[0]]*(1-u-v)+normals[face[1]]*u+normals[face[2]]*v
        ids[y,x]=index
    directions/=np.maximum(1e-8,np.linalg.norm(directions,axis=-1,keepdims=True))
    return positions,directions,ids


def project_views(points,normals,views,depths):
    colours=[];surface_normals=[];weights=[];fallback=[]
    for k,view in enumerate(views):
        uv,z=project(points,k)
        eye,rotation=camera(k)
        toward=eye-points;toward/=np.linalg.norm(toward,axis=-1,keepdims=True)
        facing=np.maximum(0,np.sum(normals*toward,axis=1))
        observed=sample(view['normal'],uv)@rotation
        observed/=np.maximum(1e-6,np.linalg.norm(observed,axis=1,keepdims=True))
        agree=np.maximum(0,np.sum(normals*observed,axis=1))
        inside=sample(view['sdf'],uv)>.7
        visible=z<=sample(depths[k],(uv+.5)/2-.5)+.025
        raw=facing**6*inside
        weight=raw*(.05+.95*agree**2)*np.where(visible,1,.0001)
        colours.append(np.clip(sample(view['colour'],uv),0,255)/255)
        surface_normals.append(observed)
        weights.append(weight);fallback.append(raw)
    weights=np.stack(weights);fallback=np.stack(fallback)
    bad=np.sum(weights,axis=0)<1e-8
    weights[:,bad]=fallback[:,bad]
    # Prefer a well aligned view rather than blur multiple displaced details.
    weights=weights**1.8
    weights/=np.maximum(1e-16,np.sum(weights,axis=0))
    colour=np.sum(np.stack(colours)**2.2*weights[...,None],axis=0)**(1/2.2)
    normal=np.sum(np.stack(surface_normals)*weights[...,None],axis=0)
    normal/=np.maximum(1e-8,np.linalg.norm(normal,axis=-1,keepdims=True))
    invalid=(np.sum(normal*normals,axis=-1)<.2)|(~np.isfinite(normal).all(axis=-1))
    normal[invalid]=normals[invalid]
    return np.clip(colour*255,0,255).astype(np.uint8),normal


def tangent_frames(vertices,faces,uv):
    edges=vertices[faces[:,1:]]-vertices[faces[:,0,None]]
    delta=uv[faces[:,1:]]-uv[faces[:,0,None]]
    det=delta[:,0,0]*delta[:,1,1]-delta[:,0,1]*delta[:,1,0]
    det=np.where(np.abs(det)<1e-12,1e-12,det)
    tangent=(edges[:,0]*delta[:,1,1,None]-edges[:,1]*delta[:,0,1,None])/det[:,None]
    bitangent=(-edges[:,0]*delta[:,1,0,None]+edges[:,1]*delta[:,0,0,None])/det[:,None]
    return tangent,bitangent
