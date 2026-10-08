"""Paint a measured vertical water sheet, with explicit sculpted rock exclusions."""
import numpy as np


def apply_waterfall(positions, colours, roughness, recipe):
    settings = recipe.get('waterfall')
    if not settings:
        return colours, roughness
    x, y, z = positions.T
    profile = np.array(settings['profileXZMM'])
    front = np.interp(z, profile[:, 1], profile[:, 0])
    distance = np.abs(x-front)
    weight = np.clip((settings['widthMM']-distance)/settings.get('featherMM', .8), 0, 1)
    weight *= np.clip((y-settings['minYMM'])/.8, 0, 1) * np.clip((settings['maxYMM']-y)/.8, 0, 1)
    weight *= np.clip((z-settings['minZMM'])/.5, 0, 1) * np.clip((settings['maxZMM']-z)/.5, 0, 1)
    for area in settings.get('rockExclusions', []):
        radius = np.linalg.norm((positions-np.array(area['centreMM']))/np.array(area['radiiMM']), axis=1)
        weight *= 1-np.clip((1-radius)/.12, 0, 1)
    fraction = np.clip((z-settings['minZMM'])/(settings['maxZMM']-settings['minZMM']), 0, 1)
    colour = np.array(settings['lowerRGB'])*(1-fraction[:, None]) + np.array(settings['upperRGB'])*fraction[:, None]
    streak = .94 + .06*np.sin(y*1.7+z*.08) + .025*np.sin(y*4.9)
    colour = np.clip(colour*streak[:, None], 0, 1)
    colours = colours*(1-weight[:, None]) + colour*weight[:, None]
    roughness = roughness*(1-weight) + settings.get('roughness', .48)*weight
    return colours, roughness
