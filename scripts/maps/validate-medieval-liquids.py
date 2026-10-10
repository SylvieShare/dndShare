"""Ray-test small potion floors and sample their actual packed albedo pixels."""
import argparse
from hashlib import sha256
import json
from pathlib import Path
import struct
import sys

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

ROOT = Path(__file__).resolve().parents[2]


def base_color_images(filename):
    data = filename.read_bytes()
    if data[:4]!=b'glTF': raise ValueError('Binary glTF required')
    document = binary = None
    offset = 12
    while offset<len(data):
        length, kind = struct.unpack_from('<II',data,offset)
        chunk = data[offset+8:offset+8+length]
        if kind==0x4E4F534A: document = json.loads(chunk)
        if kind==0x004E4942: binary = chunk
        offset += 8+length
    images = []
    for material in document['materials']:
        texture = material.get('pbrMetallicRoughness',{}).get('baseColorTexture')
        if texture is None: continue
        image = document['images'][document['textures'][texture['index']]['source']]
        view = document['bufferViews'][image['bufferView']]
        if view['buffer']!=0: raise ValueError('Embedded image buffer required')
        start = view.get('byteOffset',0)
        images.append(sha256(binary[start:start+view['byteLength']]).hexdigest())
    return sorted(images)


def sample_image(image, uv):
    width, height = image.size
    x, y = uv.x*width-.5, uv.y*height-.5
    ix, iy = int(x//1), int(y//1)
    dx, dy = x-ix, y-iy
    rgb = [0., 0., 0.]
    for ox, oy, weight in [(0,0,(1-dx)*(1-dy)), (1,0,dx*(1-dy)), (0,1,(1-dx)*dy), (1,1,dx*dy)]:
        pos = ((iy+oy)%height*width+(ix+ox)%width)*4
        for channel in range(3): rgb[channel] += image.pixels[pos+channel]*weight
    return rgb


def validate(code, candidate):
    directory = ROOT/'models/collections/medieval-town-vol1/review'/code
    if candidate: directory /= 'candidates/'+candidate
    report_path = directory/'report.json'
    report = json.loads(report_path.read_text())
    parts = [p for p in report['recipe']['materials'].get('surfaceParts', []) if p['kind']=='liquid']
    if not parts: raise ValueError('Measured liquid surfaces required')
    evidence = {}
    for tier, filename in [('render','preview-model.glb'), ('lod','lod-preview-model.glb')]:
        if base_color_images(directory/filename)!=base_color_images(directory/(tier+'.glb')):
            raise ValueError('Preview albedo differs from actual packed '+tier+' resource')
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(directory/filename))
        meshes = [(obj, BVHTree.FromObject(obj,bpy.context.evaluated_depsgraph_get()))
                  for obj in bpy.context.scene.objects if obj.type=='MESH']
        rows = []
        for part in parts:
            if part.get('rotationZDeg'): raise ValueError('Liquid probe currently requires native coordinates')
            x, y, z = part.get('probeMM', part.get('ellipsoid', {}).get('centerMM', []))
            hits = []
            for obj, tree in meshes:
                inv = obj.matrix_world.inverted()
                origin = inv@Vector((x/35,y/35,(z+.75)/35))
                direction = inv.to_3x3()@Vector((0,0,-1))
                hit = tree.ray_cast(origin,direction)
                if hit[0] is not None: hits.append(((obj.matrix_world@hit[0]).z*35,obj,hit))
            if not hits: raise ValueError('Missing liquid floor: '+part['name'])
            height, obj, hit = max(hits,key=lambda row:row[0])
            normal = obj.matrix_world.to_3x3()@hit[1]; normal.normalize()
            polygon = obj.data.polygons[hit[2]]
            if len(polygon.loop_indices)!=3: raise ValueError('Triangulated publication geometry required')
            loops = list(polygon.loop_indices)
            positions = [obj.data.vertices[obj.data.loops[i].vertex_index].co for i in loops]
            coords = [Vector((*obj.data.uv_layers.active.data[i].uv,0)) for i in loops]
            uv = barycentric_transform(hit[0],*positions,*coords)
            material = obj.data.materials[polygon.material_index]
            shader = next(n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
            image = shader.inputs['Base Color'].links[0].from_node.image
            rgb = sample_image(image,uv)
            dominant = max(range(3),key=lambda channel:part['rgb'][channel])
            other = max(v for channel,v in enumerate(rgb) if channel!=dominant)
            ratio = rgb[dominant]/max(other,1e-6)
            row = dict(name=part['name'],positionMM=[x,y,height],referenceHeightMM=z,
                       deviationMM=abs(height-z),normalZ=normal.z,uv=list(uv[:2]),
                       sampledRGB=rgb,dominantChannel=dominant,dominantRatio=ratio)
            print('MEDIEVAL_LIQUID_PIXEL',code,tier,json.dumps(row),flush=True)
            if abs(height-z)>.1 or normal.z<.5: raise ValueError('Liquid floor changed in '+tier)
            if ratio<1.1: raise ValueError('Packing lost liquid pigment in '+tier+': '+part['name'])
            rows.append(row)
        evidence[tier] = rows
    report['liquidPixelReview'] = evidence
    report['liquidPixelAssets'] = {tier:sha256((directory/(tier+'.glb')).read_bytes()).hexdigest()
                                   for tier in ['render','lod']}
    report_path.write_text(json.dumps(report,indent=2)+'\n')


if __name__=='__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--code',required=True)
    parser.add_argument('--candidate',choices=['compact'])
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    validate(args.code,args.candidate)
