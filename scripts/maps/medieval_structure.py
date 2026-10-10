"""Individually measured beam, stone and iron regions for timber structures."""
import numpy as np

REFERENCE_TREES = {}

def initialize_references(settings):
    import bpy, json, hashlib
    from pathlib import Path
    from mathutils.bvhtree import BVHTree
    root = Path(__file__).resolve().parents[2]
    inventory = json.loads((root/'models/collections/medieval-town-vol1/inventory.json').read_text())
    def visit(part):
        ref = part.get('awayFromSource')
        if ref and ref['code'] not in REFERENCE_TREES:
            row = next(r for r in inventory if r['code']==ref['code'])
            filename = root/'models'/row['sourcePath']
            with filename.open('rb') as stream:
                if row['sourceSHA256']!=ref['sourceSHA256'] or hashlib.file_digest(stream,'sha256').hexdigest()!=ref['sourceSHA256']:
                    raise ValueError('Source reference changed')
            bpy.ops.wm.stl_import(filepath=str(filename))
            other = bpy.context.object
            REFERENCE_TREES[ref['code']] = BVHTree.FromObject(other,bpy.context.evaluated_depsgraph_get())
            bpy.data.objects.remove(other,do_unlink=True)
        for child in part.get('includeParts', [])+part.get('excludeParts', []): visit(child)
    for key in ['woodParts','stoneParts','fabricParts','produceParts','surfaceParts','ironParts']:
        for part in settings.get(key, []): visit(part)


def coordinates(p, part):
    if 'rotationZDeg' not in part: return p
    angle = np.deg2rad(part['rotationZDeg'])
    delta = p-np.array(part['centerMM'])
    return np.column_stack([delta[:, 0]*np.cos(angle)+delta[:, 1]*np.sin(angle),
                           -delta[:, 0]*np.sin(angle)+delta[:, 1]*np.cos(angle), delta[:, 2]])


def domain(p, part):
    q = coordinates(p, part)
    mask = np.all((q>=part['minMM'])&(q<=part['maxMM']), axis=1)
    if 'ellipsoid' in part:
        e = part['ellipsoid']
        mask &= (((q-np.array(e['centerMM']))/np.array(e['radiiMM']))**2).sum(1)<=1
    if 'absYMM' in part:
        mask &= (np.abs(p[:, 1])>=part['absYMM'][0])&(np.abs(p[:, 1])<=part['absYMM'][1])
    if 'projection' in part:
        s = part['projection']; t = (p-np.array(s['originMM']))@np.array(s['axis'])
        mask &= (t>=s['rangeMM'][0])&(t<=s['rangeMM'][1])
    if part.get('includeParts'):
        included = np.zeros(len(p), bool)
        for child in part['includeParts']: included |= domain(p, child)
        mask &= included
    for excluded in part.get('excludeParts', []):
        mask &= ~domain(p, excluded)
    if part.get('awayFromSource'):
        ref = part['awayFromSource']; tree = REFERENCE_TREES[ref['code']]
        candidates = np.flatnonzero(mask)
        for i in candidates:
            mask[i] = tree.find_nearest(tuple(p[i]),ref['matchMM'])[0] is None
    return mask


def paint(obj, recipe):
    from medieval_material import paint as terrain
    terrain(obj, {**recipe, 'materials': {**recipe['materials'], 'kind': 'terrain'}})
    mesh = obj.data; settings = recipe['materials']
    initialize_references(settings)
    a = np.empty(len(mesh.vertices)*3, np.float32); mesh.vertices.foreach_get('co', a)
    p = a.reshape(-1, 3); x, y, z = p.T
    n = np.empty_like(a); mesh.vertices.foreach_get('normal', n); nx, ny, nz = n.reshape(-1, 3).T
    values = np.empty(len(z)*4, np.float32); mesh.color_attributes['Paint'].data.foreach_get('color', values)
    linear = values.reshape(-1, 4)[:, :3]
    rgb = np.where(linear<=.0031308, linear*12.92, 1.055*linear**(1/2.4)-.055)
    mesh.color_attributes['Surface'].data.foreach_get('color', values); surface = values.reshape(-1, 4).copy()
    for part in settings['woodParts']:
        mask = domain(p, part)
        q = coordinates(p, part)
        axis = part.get('axis', 'z')
        angle = np.deg2rad(part.get('rotationZDeg', 0))
        qnx, qny = nx*np.cos(angle)+ny*np.sin(angle), -nx*np.sin(angle)+ny*np.cos(angle)
        if axis=='z': u, v = q[:, 2], np.where(np.abs(qnx)>np.abs(qny), q[:, 1], q[:, 0])
        elif axis=='x': u, v = q[:, 0], np.where(np.abs(qny)>np.abs(nz), q[:, 2], q[:, 1])
        elif axis=='y': u, v = q[:, 1], np.where(np.abs(qnx)>np.abs(nz), q[:, 2], q[:, 0])
        elif axis=='meridian':
            u = z
            v = np.arctan2(y-part['centerXYMM'][1], x-part['centerXYMM'][0])*part['radiusMM']
        elif axis=='log-x':
            centers = np.array(part['capCentersMM'])
            nearest = ((p[:, None, 1:]-centers[None, :, 1:])**2).sum(2).argmin(1)
            dy, dz = y-centers[nearest, 1], z-centers[nearest, 2]
            u, v = x, np.arctan2(dz, dy)*part['grainRadiusMM']
        elif axis=='floor-frame':
            horizontal = np.abs(y)>part['frameInnerHalfMM']
            u, v = np.where(horizontal, x, y), np.where(horizontal, y, x)
        elif axis=='diagonal-xz':
            angle = np.deg2rad(part['angleDeg'])
            u, v = x*np.cos(angle)+z*np.sin(angle), -x*np.sin(angle)+z*np.cos(angle)
        elif axis=='beam':
            direction = np.array(part['direction'], float)
            direction /= np.linalg.norm(direction)
            helper = np.array([1.,0.,0.]) if abs(direction[0])<.8 else np.array([0.,1.,0.])
            transverse = np.cross(direction, helper); transverse /= np.linalg.norm(transverse)
            other = np.cross(direction, transverse)
            normals = np.column_stack([nx, ny, nz])
            u = p@direction
            v = np.where(np.abs(normals@transverse)>np.abs(normals@other), p@other, p@transverse)
        elif axis=='arc-xz':
            dx, dz = x-part['centerXZMM'][0], z-part['centerXZMM'][1]
            u, v = np.arctan2(dz, dx)*part['radiusMM'], np.hypot(dx, dz)
        elif axis=='crate':
            a = np.deg2rad(part['rotationZDeg'])
            qnx, qny = nx*np.cos(a)+ny*np.sin(a), -nx*np.sin(a)+ny*np.cos(a)
            along_x = np.abs(qny)>=np.abs(qnx)
            u, v = np.where(along_x, q[:, 0], q[:, 1]), z.copy()
            hx, hy = part['halfXYMM']
            corners = (np.abs(q[:, 0])>hx-part['railWidthMM'])&(np.abs(q[:, 1])>hy-part['railWidthMM'])
            u = np.where(corners, z, u)
            v = np.where(corners, np.where(along_x, q[:, 0], q[:, 1]), v)
            top = nz>.6
            frame_x = np.abs(q[:, 1])>hy-part['railWidthMM']
            frame_y = np.abs(q[:, 0])>hx-part['railWidthMM']
            top_x = frame_x|((~frame_y)&(part.get('lidAxis', 'y')=='x'))
            u = np.where(top, np.where(top_x, q[:, 0], q[:, 1]), u)
            v = np.where(top, np.where(top_x, q[:, 1], q[:, 0]), v)
        else: raise ValueError('Unknown measured timber axis')
        grain = np.clip(.5+.22*np.sin(v*6.8+.12*np.sin(u*.4))+.10*np.sin(v*18+.04*np.sin(u*.7)), .1, .9)
        wood = np.array(part.get('darkRGB', settings['woodDarkRGB']))*(1-grain[:, None])+np.array(part.get('lightRGB', settings['woodLightRGB']))*grain[:, None]
        wood *= (1+.045*np.sin(u*.17+v*.1))[:, None]
        # Visible ends of straight beams; curved grain follows the actual arc.
        ends = mask&((np.abs(nx)>.75) if axis=='x' else (np.abs(ny)>.75) if axis=='y' else (np.abs(nz)>.75) if axis=='z' else False)
        wood[ends] *= (.85+.15*np.sin(np.hypot(v[ends], u[ends]%4)*7))[:, None]
        roughness = np.full(len(z), part.get('roughness', .88), np.float32)
        if axis=='log-x':
            end_region = np.zeros(len(z), bool)
            for lo, hi in part['endRangesMM']: end_region |= (x>=lo)&(x<=hi)
            cap = mask&end_region&(np.abs(nx)>.55)
            radius = np.hypot(dy, dz)
            rings = .5+.24*np.sin(radius*5.8+.1*np.sin(np.arctan2(dz,dy)*3))
            cut = np.array(part['endDarkRGB'])*(1-rings[:, None])+np.array(part['endLightRGB'])*rings[:, None]
            wood[cap] = cut[cap]
            roughness[end_region] = part['endRoughness']
            print('MEDIEVAL_LOG_ENDS', int(cap.sum()), len(centers), flush=True)
        rgb[mask] = wood[mask]; surface[mask, 1] = roughness[mask]
        print('MEDIEVAL_BEAM', part['name'], int(mask.sum()), flush=True)
    for part in settings.get('stoneParts', []):
        mask = domain(p, part)
        variation = .5+.2*np.sin(x*.25+y*.35+z*.12)
        stone = np.array(part['darkRGB'])*(1-variation[:, None])+np.array(part['lightRGB'])*variation[:, None]
        rgb[mask] = stone[mask]; surface[mask, 1] = .91; surface[mask, 2] = 0
    for part in settings.get('fabricParts', []):
        mask = domain(p, part)
        q = coordinates(p, part)
        if part.get('drapedOverCrate'):
            s = part['drapedOverCrate']
            mask &= ((z>=s['topStartMM'])|
                     ((z>=s['edgeStartMM'])&(np.abs(q[:, 0])<s['edgeHalfXMM'])&(np.abs(q[:, 1])>s['edgeMinYMM'])))
        weave = 1+.018*np.sin(x*9)*np.sin(y*9+z*11)
        if part.get('centersMM'):
            centers = np.array(part['centersMM'])
            distance = ((p[:, None, :2]-centers[None, :, :2])**2).sum(2)
            if part.get('centerRadiiMM'): distance /= np.array(part['centerRadiiMM'])[None, :]**2
            fabric = np.array(part['colorsRGB'])[distance.argmin(1)]*weave[:, None]
        else: fabric = np.array(part['rgb'])*weave[:, None]
        rgb[mask] = fabric[mask]; surface[mask, 1] = .98; surface[mask, 2] = 0
        print('MEDIEVAL_FABRIC', part['name'], int(mask.sum()), flush=True)
    for part in settings.get('produceParts', []):
        mask = domain(p, part)
        centers = np.array(part['centersMM'])
        nearest = ((p[:, None, :2]-centers[None, :, :2])**2).sum(2).argmin(1)
        tones = .5+.23*np.sin(centers[:, 0]*3.71+centers[:, 1]*5.39)
        t = tones[nearest]
        fruit = np.array(part['darkRGB'])*(1-t[:, None])+np.array(part['lightRGB'])*t[:, None]
        fruit *= (1+.022*np.sin(x*8.7+y*7.2+z*9.1))[:, None]
        rgb[mask] = fruit[mask]; surface[mask, 1] = part['roughness']; surface[mask, 2] = 0
        print('MEDIEVAL_PRODUCE', part['name'], int(mask.sum()), len(centers), flush=True)
    for part in settings.get('surfaceParts', []):
        mask = domain(p, part)
        if part.get('centersMM'):
            centers = np.array(part['centersMM'])
            distance = ((p[:, None, :2]-centers[None, :, :2])**2).sum(2)
            if part.get('centerRadiiMM'): distance /= np.array(part['centerRadiiMM'])[None, :]**2
            nearest = distance.argmin(1)
            finish = np.array(part['colorsRGB'])[nearest]
        else: finish = np.tile(np.array(part['rgb']), (len(z), 1))
        amplitude = part.get('variation', .025)
        finish *= (1+amplitude*np.sin(x*1.73+y*2.31+z*1.17))[:, None]
        rgb[mask] = finish[mask]; surface[mask, 1] = part['roughness']; surface[mask, 2] = part.get('metallic', 0)
        print('MEDIEVAL_SURFACE_PART', part['name'], int(mask.sum()), flush=True)
    for part in settings.get('ironParts', []):
        mask = domain(p, part)
        iron = np.array(part['rgb'])*(1+.07*np.sin(x*1.2+y*.7+z*.6))[:, None]
        rgb[mask] = iron[mask]; surface[mask, 1] = part['roughness']; surface[mask, 2] = part['metallic']
    for h in settings.get('hardware', []):
        d = ((p-np.array(h['centerMM']))/np.array(h['radiiMM']))**2
        weight = np.clip((1-d.sum(1))/.2, 0, 1)*(z>=h['minZMM'])
        rgb = rgb*(1-weight[:, None])+np.array(h['rgb'])*weight[:, None]
        surface[:, 1] = surface[:, 1]*(1-weight)+.55*weight
        surface[:, 2] = np.maximum(surface[:, 2], weight*.9)
    linear = np.where(rgb<=.04045, rgb/12.92, ((rgb+.055)/1.055)**2.4)
    mesh.color_attributes['Paint'].data.foreach_set('color', np.column_stack([linear, np.ones(len(z))]).astype(np.float32).ravel())
    mesh.color_attributes['Surface'].data.foreach_set('color', surface.astype(np.float32).ravel())
