"""Convert native STL millimetres to the editor's downward-Y footprint."""

import math


def native_to_local(recipe, point):
    cx, cy = recipe['mountCenterMM']
    return [round(recipe['width']/2+(point[0]-cx)/35, 6),
            round(recipe['height']/2-(point[1]-cy)/35, 6)]


def placement_samples(recipe):
    if 'standPointsMM' in recipe:
        if 'standPoints' in recipe:
            raise ValueError('Choose native or local stand points, not both')
        return [(*native_to_local(recipe, p), *p) for p in recipe['standPointsMM']]
    locations = recipe.get('standPoints', [[x+.5, y+.5] for x, y in recipe['standCells']])
    cx, cy = recipe['mountCenterMM']
    return [(x, y, cx+(x-recipe['width']/2)*35, cy-(y-recipe['height']/2)*35)
            for x, y in locations]


def placement_ray_tops(recipe, count):
    tops = recipe.get('standRayTopsMM', [recipe.get('standRayTopMM', 1200)] * count)
    if not isinstance(tops, list) or len(tops) != count:
        raise ValueError('Each stand point requires one native ray origin height')
    if any(isinstance(z, bool) or not isinstance(z, (int, float))
           or not math.isfinite(z) or z <= recipe.get('mountDepthMM', 0) + .1
           for z in tops):
        raise ValueError('Standing ray origins must be finite and above the mounting level')
    return tops


def model_blockers(recipe):
    if 'blockersMM' in recipe:
        if 'blockers' in recipe:
            raise ValueError('Choose native or local blockers, not both')
        return [[native_to_local(recipe, p) for p in polygon] for polygon in recipe['blockersMM']]
    return recipe['blockers']
