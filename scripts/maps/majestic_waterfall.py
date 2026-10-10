"""Paint a measured vertical water sheet, with explicit sculpted rock exclusions."""
import numpy as np


def apply_waterfall(positions, colours, roughness, recipe):
    settings = recipe.get('waterfall')
    if not settings:
        return colours, roughness
    local = positions.copy()
    angle = np.deg2rad(settings.get('rotateZ', 0))
    if angle:
        c, s = np.cos(angle), np.sin(angle)
        local[:, 0] = positions[:, 0]*c + positions[:, 1]*s
        local[:, 1] = -positions[:, 0]*s + positions[:, 1]*c
    x, y, z = local.T
    profile = np.array(settings['profileXZMM'])
    front = np.interp(z, profile[:, 1], profile[:, 0])
    difference = x-front
    front_width = settings.get('frontWidthMM', settings['widthMM'])
    back_width = settings.get('backWidthMM', settings['widthMM'])
    weight = np.clip(np.minimum(front_width+difference, back_width-difference)/settings.get('featherMM', .8), 0, 1)
    weight *= np.clip((y-settings['minYMM'])/.8, 0, 1) * np.clip((settings['maxYMM']-y)/.8, 0, 1)
    weight *= np.clip((z-settings['minZMM'])/.5, 0, 1) * np.clip((settings['maxZMM']-z)/.5, 0, 1)
    stone_masks = []
    for area in settings.get('rockExclusions', []):
        radius = np.linalg.norm((local-np.array(area['centreMM']))/np.array(area['radiiMM']), axis=1)
        stone = np.clip((1-radius)/.12, 0, 1)
        weight *= 1-stone
        if 'rgb' in area:
            stone_masks.append((area, stone))
    fraction = np.clip((z-settings['minZMM'])/(settings['maxZMM']-settings['minZMM']), 0, 1)
    colour = np.array(settings['lowerRGB'])*(1-fraction[:, None]) + np.array(settings['upperRGB'])*fraction[:, None]
    streak = .94 + .06*np.sin(y*1.7+z*.08) + .025*np.sin(y*4.9)
    colour = np.clip(colour*streak[:, None], 0, 1)
    colours = colours*(1-weight[:, None]) + colour*weight[:, None]
    roughness = roughness*(1-weight) + settings.get('roughness', .48)*weight
    for area, stone in stone_masks:
        shade = 1+.04*np.sin(x*.51+y*.43+z*.21)
        colours = colours*(1-stone[:, None]) + np.array(area['rgb'])*shade[:, None]*stone[:, None]
        roughness = roughness*(1-stone) + area.get('roughness', .82)*stone
    return colours, roughness


def waterfall_stone_finish(nodes, links, finish, recipe):
    settings = recipe.get('waterfall', {})
    if not settings.get('perPixelRocks'):
        return finish
    coords = nodes.new('ShaderNodeTexCoord')
    for index, area in enumerate(settings.get('rockExclusions', [])):
        if 'rgb' not in area:
            continue
        delta = nodes.new('ShaderNodeVectorMath'); delta.operation = 'SUBTRACT'
        links.new(coords.outputs['Object'], delta.inputs[0])
        delta.inputs[1].default_value = area['centreMM']
        scaled = nodes.new('ShaderNodeVectorMath'); scaled.operation = 'DIVIDE'
        links.new(delta.outputs['Vector'], scaled.inputs[0])
        scaled.inputs[1].default_value = area['radiiMM']
        length = nodes.new('ShaderNodeVectorMath'); length.operation = 'LENGTH'
        links.new(scaled.outputs['Vector'], length.inputs[0])
        mask = nodes.new('ShaderNodeMapRange')
        mask.name = f'Majestic Waterfall Stone {index}'
        mask['roughness'] = area.get('roughness', .82)
        mask.clamp = True
        mask.inputs['From Min'].default_value = .88
        mask.inputs['From Max'].default_value = 1
        mask.inputs['To Min'].default_value = 1
        mask.inputs['To Max'].default_value = 0
        links.new(length.outputs['Value'], mask.inputs['Value'])
        painted = nodes.new('ShaderNodeMixRGB')
        links.new(mask.outputs['Result'], painted.inputs[0])
        links.new(finish.outputs[0], painted.inputs[1])
        rgb = np.array(area['rgb'])
        linear = np.where(rgb <= .04045, rgb/12.92, ((rgb+.055)/1.055)**2.4)
        painted.inputs[2].default_value = (*linear, 1)
        finish = painted
    return finish


def waterfall_stone_orm(nodes, links, combine, surface, previous=None):
    if previous:
        previous(nodes, links, combine, surface)
    original = combine.inputs['Green'].links[0].from_socket
    for mask in list(nodes):
        if not mask.name.startswith('Majestic Waterfall Stone '):
            continue
        desired = mask.get('roughness', .82)
        difference = nodes.new('ShaderNodeMath'); difference.operation = 'SUBTRACT'
        difference.inputs[0].default_value = desired
        links.new(original, difference.inputs[1])
        delta = nodes.new('ShaderNodeMath'); delta.operation = 'MULTIPLY'
        links.new(difference.outputs[0], delta.inputs[0])
        links.new(mask.outputs['Result'], delta.inputs[1])
        repaired = nodes.new('ShaderNodeMath'); repaired.operation = 'ADD'
        links.new(original, repaired.inputs[0])
        links.new(delta.outputs[0], repaired.inputs[1])
        original = repaired.outputs[0]
    links.new(original, combine.inputs['Green'])
