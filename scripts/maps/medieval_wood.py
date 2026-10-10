"""Measured timber directions for Medieval Town floor planks and frame beams."""
import numpy as np
import bpy
import json
from pathlib import Path
from mathutils.bvhtree import BVHTree


def paint(obj, recipe):
    settings = recipe['materials']
    mesh = obj.data
    values = np.empty(len(mesh.vertices)*3, np.float32)
    mesh.vertices.foreach_get('co', values)
    x, y, z = values.reshape(-1, 3).T
    normals = np.empty_like(values); mesh.vertices.foreach_get('normal', normals)
    nx, ny, nz = normals.reshape(-1, 3).T
    band = settings['frameInnerHalfMM']
    # Source normal variance confirms Y-oriented inner planks and east/west
    # rails; the north/south rails run along X. Side faces follow their beam.
    along_x = (np.abs(y)>band)|((z<settings['floorTopStartMM'])&(np.abs(ny)>.6))
    along_y = (np.abs(x)>band)|((z<settings['floorTopStartMM'])&(np.abs(nx)>.6))
    along_x &= ~((np.abs(x)>band)&(np.abs(y)<=band))
    u = np.where(along_x, x, y)
    v = np.where(along_x, y, x)
    cross_weight = np.zeros(len(x), np.float32)
    if settings.get('crossReference'):
        ref = settings['crossReference']
        root = Path(__file__).resolve().parents[2]
        rows = json.loads((root/'models/collections/medieval-town-vol1/inventory.json').read_text())
        row = next(r for r in rows if r['code']==ref['code'])
        bpy.ops.wm.stl_import(filepath=str(root/'models'/row['sourcePath']))
        other = bpy.context.object
        tree = BVHTree.FromObject(other, bpy.context.evaluated_depsgraph_get())
        distance = np.array([tree.find_nearest(vertex.co)[3] for vertex in mesh.vertices], np.float32)
        bpy.data.objects.remove(other, do_unlink=True)
        cross_weight = np.clip((distance-ref['matchMM'])/ref['blendMM'], 0, 1)
        cross_weight *= (z>=ref['minZMM'])&(np.abs(x)<14.6)&(np.abs(y)<14.6)
        upper = (z>settings['upperCrossMinZMM'])&(np.abs(x+y)<4)
        angle = np.deg2rad(np.where(upper, settings['upperCrossAngleDeg'], settings['lowerCrossAngleDeg']))
        dx, dy = x-settings['crossCenterMM'][0], y-settings['crossCenterMM'][1]
        cu = dx*np.cos(angle)+dy*np.sin(angle)
        cv = -dx*np.sin(angle)+dy*np.cos(angle)
        u = u*(1-cross_weight)+cu*cross_weight
        v = v*(1-cross_weight)+cv*cross_weight
        print('MEDIEVAL_CROSS_REFERENCE', float(cross_weight.mean()), flush=True)
    grain = .5+.22*np.sin(v*5.7+.15*np.sin(u*.39)+.12*np.sin(u*.85))
    grain += .12*np.sin(v*17.3+.04*np.sin(u*.57))
    patch = .045*np.sin(u*.19+v*.11)
    grain = np.clip(grain+patch, .12, .9)
    dark, light = np.array(settings['woodDarkRGB']), np.array(settings['woodLightRGB'])
    rgb = dark*(1-grain[:, None])+light*grain[:, None]
    board = np.floor((v+band)/settings['plankWidthMM'])
    variance = 1+.065*np.sin(board*12.9898+78.233)
    rgb *= variance[:, None]
    side = np.clip((settings['floorTopStartMM']-z)/settings['topBlendMM'], 0, 1)
    rgb *= (1-.15*side[:, None])
    # End grain on the exposed ends of each measured frame member.
    end = ((along_x&(np.abs(nx)>.65))|(along_y&(np.abs(ny)>.65)))&(z>settings['floorTopStartMM'])
    radius = np.sqrt((v-np.sign(v)*(band+1.5))**2+(z-settings['endCenterZMM'])**2)
    rings = .87+.13*np.sin(radius*6.5)
    rgb[end] *= rings[end, None]
    rgb = np.clip(rgb, .025, .9)
    metallic = np.zeros(len(x), np.float32)
    for hardware in settings.get('hardware', []):
        center = np.array(hardware['centerMM'])
        radius = np.array(hardware['radiiMM'])
        d = ((values.reshape(-1, 3)-center)/radius)**2
        weight = np.clip((1-d.sum(1))/.2, 0, 1)
        weight *= z>=hardware['minZMM']
        rgb = rgb*(1-weight[:, None])+np.array(hardware['rgb'])*weight[:, None]
        metallic = np.maximum(metallic, weight)
    linear = np.where(rgb<=.04045, rgb/12.92, ((rgb+.055)/1.055)**2.4)
    attr = mesh.color_attributes.new('Paint', 'FLOAT_COLOR', 'POINT')
    attr.data.foreach_set('color', np.column_stack([linear, np.ones(len(x))]).astype(np.float32).ravel())
    roughness = .9-.04*grain
    roughness = roughness*(1-metallic)+.43*metallic
    surface = mesh.color_attributes.new('Surface', 'FLOAT_COLOR', 'POINT')
    surface.data.foreach_set('color', np.column_stack([np.ones(len(x)), roughness,
                                                     metallic, np.ones(len(x))]).astype(np.float32).ravel())
    print('MEDIEVAL_WOOD_DIRECTIONS', int(along_x.sum()), int(along_y.sum()), int(end.sum()), flush=True)
