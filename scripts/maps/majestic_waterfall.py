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
