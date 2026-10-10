"""Measured timber, iron basket and flame domains of MT1-016/017."""
import json
from pathlib import Path
import bpy
import numpy as np
from mathutils.bvhtree import BVHTree


def paint(obj, recipe):
    from medieval_material import paint as terrain
    base = {**recipe, 'materials': {**recipe['materials'], 'kind': 'terrain'}}
    terrain(obj, base)
    mesh = obj.data; settings = recipe['materials']; spec = settings['torch']
    positions = np.empty(len(mesh.vertices)*3, np.float32)
    mesh.vertices.foreach_get('co', positions); p = positions.reshape(-1, 3)
    x, y, z = p.T
    normals = np.empty_like(positions); mesh.vertices.foreach_get('normal', normals)
    nx, ny, nz = normals.reshape(-1, 3).T
    values = np.empty(len(z)*4, np.float32)
    mesh.color_attributes['Paint'].data.foreach_get('color', values)
    linear = values.reshape(-1, 4)[:, :3]
    rgb = np.where(linear<=.0031308, linear*12.92, 1.055*linear**(1/2.4)-.055)
    mesh.color_attributes['Surface'].data.foreach_get('color', values)
    surface = values.reshape(-1, 4).copy()
    radius = np.hypot(x-spec['basketCenterMM'][0], y-spec['basketCenterMM'][1])
    domain = np.all((p>=spec['woodMinMM'])&(p<=spec['woodMaxMM']), axis=1)
    # Both the squared foot and round pole have longitudinal vertical grain.
    grain_u = np.where(np.abs(nx)>np.abs(ny), y, x)
    grain = np.clip(.5+.22*np.sin(grain_u*7+.1*np.sin(z*.42))+
                    .11*np.sin(grain_u*19+.035*np.sin(z*.65)), .1, .9)
    wood = np.array(spec['woodDarkRGB'])*(1-grain[:, None])+np.array(spec['woodLightRGB'])*grain[:, None]
    end = domain&(nz>.65)&(z>42.5)&(z<44)
    rings = .86+.14*np.sin(radius*7)
    wood[end] *= rings[end, None]
    rgb[domain] = wood[domain]; surface[domain, 1] = .88
    # Charred fuel remains inside the metal basket, including the rolled end.
    fuel = (z>=spec['fuelMinZMM'])&(z<=spec['fuelMaxZMM'])&(radius<spec['fuelRadiusMM'])
    char = np.array(spec['fuelRGB'])*(1+.13*np.sin(grain_u*7+z*.4))[:, None]
    fuel_end = fuel&(nz>.5)
    char[fuel_end] *= (.85+.15*np.sin(radius[fuel_end]*8))[:, None]
    rgb[fuel] = char[fuel]; surface[fuel, 1] = .98
    metal = np.zeros(len(z), np.float32)
    for part in spec['ironDomains']:
        mask = (z>=part['zMM'][0])&(z<=part['zMM'][1])&(radius>=part.get('minRadiusMM', 0))&(radius<=part['maxRadiusMM'])
        metal[mask] = 1
    for h in settings['hardware']:
        d = ((p-np.array(h['centerMM']))/np.array(h['radiiMM']))**2
        w = np.clip((1-d.sum(1))/.2, 0, 1)*(z>=h['minZMM'])
        metal = np.maximum(metal, w)
    iron = np.array(spec['ironRGB'])*(1+.08*np.sin(x*1.7+y*2.1+z*1.2))[:, None]
    rgb = rgb*(1-metal[:, None])+iron*metal[:, None]
    surface[:, 1] = surface[:, 1]*(1-metal)+.58*metal
    surface[:, 2] = metal*.92
    flame = np.zeros(len(z), np.float32)
    if spec.get('flameReference'):
        root = Path(__file__).resolve().parents[2]
        rows = json.loads((root/'models/collections/medieval-town-vol1/inventory.json').read_text())
        row = next(r for r in rows if r['code']==spec['flameReference'])
        bpy.ops.wm.stl_import(filepath=str(root/'models'/row['sourcePath']))
        other = bpy.context.object
        tree = BVHTree.FromObject(other, bpy.context.evaluated_depsgraph_get())
        chosen = (z>=spec['flameMinZMM'])&(radius<spec['flameRadiusMM'])
        distances = np.zeros(len(z), np.float32)
        for i in np.flatnonzero(chosen): distances[i] = tree.find_nearest(mesh.vertices[int(i)].co)[3]
        bpy.data.objects.remove(other, do_unlink=True)
        flame = np.clip((distances-spec['flameMatchMM'])/spec['flameBlendMM'], 0, 1)*chosen
        t = np.clip((z-spec['flameMinZMM'])/(spec['flameTopZMM']-spec['flameMinZMM']), 0, 1)
        fire = np.array([1, .72, .08])*(1-t[:, None])+np.array([1, .25, .015])*t[:, None]
        rgb = rgb*(1-flame[:, None])+fire*flame[:, None]
        surface[:, 1] = surface[:, 1]*(1-flame)+.9*flame
        surface[:, 2] *= 1-flame
        print('MEDIEVAL_FLAME', int((flame>.5).sum()), np.quantile(distances[chosen], [0, .5, .9, 1]).tolist(), flush=True)
    linear = np.where(rgb<=.04045, rgb/12.92, ((rgb+.055)/1.055)**2.4)
    mesh.color_attributes['Paint'].data.foreach_set('color', np.column_stack([linear, np.ones(len(z))]).astype(np.float32).ravel())
    mesh.color_attributes['Surface'].data.foreach_set('color', surface.astype(np.float32).ravel())
    if spec.get('flameReference'):
        attr = mesh.color_attributes.new('Flame', 'FLOAT_COLOR', 'POINT')
        attr.data.foreach_set('color', np.column_stack([flame, flame, flame, np.ones(len(z))]).astype(np.float32).ravel())
    print('MEDIEVAL_TORCH_PARTS', int(domain.sum()), int(fuel.sum()), int((metal>.5).sum()), flush=True)


def emission_bake(recipe):
    if not recipe['materials'].get('torch', {}).get('flameReference'):
        return None
    def bake(target, directory, nodes, links, shader, output):
        from majestic_camp import bake_emission
        bake_emission(target, directory, nodes, links, shader, output,
                      recipe['materials']['torch']['emissionStrength'])
    return bake
