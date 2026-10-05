"""Spatial material masks for the fused, untextured Ultimate Dungeon scans.

Coordinates use cropped STL millimetres. Painting is deliberately restrained:
stone, timber, iron, linen, ivory and accent colours, rather than baked lighting.
"""
import bpy
import numpy as np
from ud006_material import timber_parts, SPEC as TIMBER_SPEC

PALETTE = {
    'stone': (.34, .375, .39), 'wood': (.39, .22, .105),
    'iron': (.34, .35, .33), 'bone': (.79, .72, .52),
    'cloth': (.39, .17, .14), 'sack': (.57, .49, .29),
    'ceramic': (.69, .61, .45), 'water': (.16, .37, .43),
    'toxic': (.32, .52, .12), 'crystal': (.24, .52, .64),
    'gold': (.72, .49, .16), 'fire': (.9, .36, .055),
    'fruit': (.47, .55, .23),
}


def paint(obj, row):
    mesh = obj.data
    coords = np.empty(len(mesh.vertices)*3, np.float32)
    mesh.vertices.foreach_get('co', coords)
    xyz = coords.reshape(-1, 3)
    x, y, z = xyz.T
    x = x-(row['min'][0]+row['max'][0])/2
    y = y-(row['min'][1]+row['max'][1])/2
    code = int(row['code'].split('-')[1]) if row['code'].split('-')[1].isdigit() else 0
    colour = np.tile(PALETTE['stone'], (len(x), 1))
    rough = np.full(len(x), .87)
    metal = np.zeros(len(x))

    def region(mask, kind):
        colour[mask] = PALETTE[kind]
        if kind in ['iron', 'gold']:
            metal[mask] = .35 if kind=='iron' else .65
            rough[mask] = .58
        elif kind in ['water', 'toxic', 'crystal']:
            rough[mask] = .3
        elif kind in ['wood', 'ceramic']:
            rough[mask] = .72

    floor = z<15.8
    # Raised detail is separate from masonry and the intact mounting-free floor.
    if code in [2, 3, 13, 25, 69, 70, 71, 76]:
        region((z>15.3)&(x<7.2), 'bone')
    if code==6:
        timber = timber_parts(x, y, z)>0
        region(timber, 'wood')
        colour[timber] = TIMBER_SPEC['woodColor']
        rough[timber] = .87
    if code==40:
        region((z>34)&(x>7), 'wood')
        region(floor & (z>13.8), 'wood')
    if code==35:
        region(z>12, 'wood')
    if code in [10, 11, 82, 83]:
        region((x>8)&(z>16)&(abs(y)<11.7)&(z<54.5), 'wood')
        region((x>8)&(z>16)&(abs(y)<11.8)&((abs(z-23)<1.1)|(abs(z-42)<1.1)), 'iron')
        if code==11:
            region((z>32)&(z<36)&(abs(y)<14), 'iron')
    if code in [27, 30]:
        region((z>15)&(x<row['width']*17.5-8), 'wood')
        region((z>23)&(abs(y)<12.3)&(x>-27)&(x<20), 'cloth')
        region((z>22)&(abs(y)<10)&(x<-20), 'sack')
    if code in [28, 29]:
        region((z>15.5)&(x<8), 'sack')
    if code in [31, 32, 33]:
        region(z>15.3, 'wood')
        if code==31:
            # Dish basins are lower than their rims: height-only masks leave
            # false wooden circles in their centres. Use the measured outlines.
            dishes = [(-8.8, -9.06, 6.1, 6.1), (-7.12, 8.96, 4.75, 4.75),
                      (10.14, 10.05, 4.6, 4.6), (8.83, -10.92, 4.55, 4.5),
                      (10.98, 3.04, 2.5, 2.5), (10.3, -4.18, 2.5, 2.5),
                      (-.77, 12.72, 2.55, 2.55), (-9.44, .17, 3, 3)]
            for cx, cy, rx, ry in dishes:
                region((z>27.8)&(((x-cx)/rx)**2+((y-cy)/ry)**2<1.04), 'ceramic')
            region((z>32)&(abs(x)<5.5)&(abs(y)<5.5), 'wood')
            region((z>33.7)&(abs(x)<5.5)&(abs(y)<5.5), 'fruit')
    if code==34:
        region((z>15)&(x<8.5), 'wood')
        region((z>16)&(x<8.5)&((abs(y-7)<1.5)|(abs(y+7)<1.5)), 'iron')
    if code in [7, 54, 55, 57, 58, 59, 60, 64, 85, 98, 109]:
        region((z>16)&(x<8.5), 'iron')
    if code in [61, 62, 63, 66, 68]:
        region((z>16)&(x<8), 'wood')
        if code in [66, 68]:
            region((z>24)&(x<8), 'iron')
    if code in [36, 37, 38, 39]:
        region(z>16, 'iron')
        if code in [36, 37, 38]:
            region((z>18)&(z<30), 'wood')
        if code==37:
            region(z>32, 'fire')
    if code in [42, 43, 44]:
        region((z>16)&(abs(x)<10)&(abs(y)<10), {42:'crystal',43:'toxic',44:'gold'}[code])
    if code in [65, 74, 75, 76, 77]:
        region((z>13.5)&(z<16.5), 'toxic' if code==65 else 'water')
    if code==80:
        region((z>29)&(abs(x)<13)&(abs(y)<12), 'cloth')
    radius = np.hypot(x, y)
    if code==87:
        region((radius<7.5)&(z>51), 'bone')
    if code==88:
        region(((radius<8.5)&(z>24))|((radius>13)&(z>24)&(z<32)&(y<-6)), 'bone')
    if code==89:
        region((x*x+((z-27-.3*y)/np.hypot(1,.3))**2<6.5**2)&(z>16), 'bone')

    # Broad variation follows real positions, without black cracks or fake light.
    variation = 1+.065*np.sin(x*.63+y*.37+z*.28)+.04*np.sin(x*1.9-y*1.1)
    wood = (colour[:, 0]==PALETTE['wood'][0])
    variation[wood] += .065*np.sin(y[wood]*2.5+np.sin(z[wood]*.18))
    srgb = np.clip(colour*variation[:, None], .045, .92)
    linear = np.where(srgb<=.04045, srgb/12.92, ((srgb+.055)/1.055)**2.4)
    colours = np.column_stack([linear, np.ones(len(x))]).astype(np.float32)
    surface = np.column_stack([np.ones(len(x)), rough, metal, np.ones(len(x))]).astype(np.float32)
    for name, values in [('Paint', colours), ('Surface', surface)]:
        attr = mesh.color_attributes.new(name, 'FLOAT_COLOR', 'POINT')
        attr.data.foreach_set('color', values.ravel())


def material():
    result = bpy.data.materials.new('Dungeon hand-painted materials')
    result.use_nodes = True
    nodes, links = result.node_tree.nodes, result.node_tree.links
    shader = nodes.get('Principled BSDF')
    colour = nodes.new('ShaderNodeVertexColor')
    colour.layer_name = 'Paint'
    geometry = nodes.new('ShaderNodeNewGeometry')
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 1.8
    noise.inputs['Detail'].default_value = 3
    noise.inputs['Roughness'].default_value = .7
    coord = nodes.new('ShaderNodeTexCoord')
    links.new(coord.outputs['Object'], noise.inputs['Vector'])
    grain = nodes.new('ShaderNodeMath')
    grain.operation = 'MULTIPLY_ADD'
    grain.inputs[1].default_value = .32
    grain.inputs[2].default_value = .84
    links.new(noise.outputs['Fac'], grain.inputs[0])
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = .38
    ramp.color_ramp.elements[0].color = (.68, .68, .68, 1)
    ramp.color_ramp.elements[1].position = .57
    ramp.color_ramp.elements[1].color = (1.12, 1.12, 1.12, 1)
    links.new(geometry.outputs['Pointiness'], ramp.inputs['Fac'])
    multiply = nodes.new('ShaderNodeMixRGB')
    multiply.blend_type = 'MULTIPLY'
    multiply.inputs[0].default_value = 1
    grain_mix = nodes.new('ShaderNodeMixRGB')
    grain_mix.blend_type = 'MULTIPLY'
    grain_mix.inputs[0].default_value = 1
    links.new(colour.outputs['Color'], grain_mix.inputs[1])
    links.new(grain.outputs[0], grain_mix.inputs[2])
    links.new(grain_mix.outputs[0], multiply.inputs[1])
    links.new(ramp.outputs['Color'], multiply.inputs[2])
    links.new(multiply.outputs['Color'], shader.inputs['Base Color'])
    shader.inputs['Roughness'].default_value = .85
    return result
