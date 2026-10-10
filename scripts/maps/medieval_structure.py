"""Individually measured beam, stone and iron regions for timber structures."""
import numpy as np


def domain(p, part):
    mask = np.all((p>=part['minMM'])&(p<=part['maxMM']), axis=1)
    if 'absYMM' in part:
        mask &= (np.abs(p[:, 1])>=part['absYMM'][0])&(np.abs(p[:, 1])<=part['absYMM'][1])
    if 'projection' in part:
        s = part['projection']; t = (p-np.array(s['originMM']))@np.array(s['axis'])
        mask &= (t>=s['rangeMM'][0])&(t<=s['rangeMM'][1])
    return mask


def paint(obj, recipe):
    from medieval_material import paint as terrain
    terrain(obj, {**recipe, 'materials': {**recipe['materials'], 'kind': 'terrain'}})
    mesh = obj.data; settings = recipe['materials']
    a = np.empty(len(mesh.vertices)*3, np.float32); mesh.vertices.foreach_get('co', a)
    p = a.reshape(-1, 3); x, y, z = p.T
    n = np.empty_like(a); mesh.vertices.foreach_get('normal', n); nx, ny, nz = n.reshape(-1, 3).T
    values = np.empty(len(z)*4, np.float32); mesh.color_attributes['Paint'].data.foreach_get('color', values)
    linear = values.reshape(-1, 4)[:, :3]
    rgb = np.where(linear<=.0031308, linear*12.92, 1.055*linear**(1/2.4)-.055)
    mesh.color_attributes['Surface'].data.foreach_get('color', values); surface = values.reshape(-1, 4).copy()
    for part in settings['woodParts']:
        mask = domain(p, part)
        axis = part.get('axis', 'z')
        if axis=='z': u, v = z, np.where(np.abs(nx)>np.abs(ny), y, x)
        elif axis=='x': u, v = x, np.where(np.abs(ny)>np.abs(nz), z, y)
        elif axis=='y': u, v = y, np.where(np.abs(nx)>np.abs(nz), z, x)
        elif axis=='floor-frame':
            horizontal = np.abs(y)>part['frameInnerHalfMM']
            u, v = np.where(horizontal, x, y), np.where(horizontal, y, x)
        elif axis=='diagonal-xz':
            angle = np.deg2rad(part['angleDeg'])
            u, v = x*np.cos(angle)+z*np.sin(angle), -x*np.sin(angle)+z*np.cos(angle)
        elif axis=='arc-xz':
            dx, dz = x-part['centerXZMM'][0], z-part['centerXZMM'][1]
            u, v = np.arctan2(dz, dx)*part['radiusMM'], np.hypot(dx, dz)
        else: raise ValueError('Unknown measured timber axis')
        grain = np.clip(.5+.22*np.sin(v*6.8+.12*np.sin(u*.4))+.10*np.sin(v*18+.04*np.sin(u*.7)), .1, .9)
        wood = np.array(settings['woodDarkRGB'])*(1-grain[:, None])+np.array(settings['woodLightRGB'])*grain[:, None]
        wood *= (1+.045*np.sin(u*.17+v*.1))[:, None]
        # Visible ends of straight beams; curved grain follows the actual arc.
        ends = mask&((np.abs(nx)>.75) if axis=='x' else (np.abs(ny)>.75) if axis=='y' else (np.abs(nz)>.75) if axis=='z' else False)
        wood[ends] *= (.85+.15*np.sin(np.hypot(v[ends], u[ends]%4)*7))[:, None]
        rgb[mask] = wood[mask]; surface[mask, 1] = .88
        print('MEDIEVAL_BEAM', part['name'], int(mask.sum()), flush=True)
    for part in settings.get('stoneParts', []):
        mask = domain(p, part)
        variation = .5+.2*np.sin(x*.25+y*.35+z*.12)
        stone = np.array(part['darkRGB'])*(1-variation[:, None])+np.array(part['lightRGB'])*variation[:, None]
        rgb[mask] = stone[mask]; surface[mask, 1] = .91; surface[mask, 2] = 0
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
