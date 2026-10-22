"""Bind generated physical stand points to reviewed, zero-based local cells."""


def placement_cells(points, recipe):
    cells = recipe.get('placementCells', recipe.get('standCells'))
    if cells is None or len(cells) != len(points):
        raise ValueError('Each stand point requires a placementCells/standCells entry')
    for point, cell in zip(points, cells):
        if len(cell) != 2 or any(not isinstance(v, int) for v in cell):
            raise ValueError('Placement cells must contain two integers')
        x, y = cell
        if not 0 <= x < recipe['width'] or not 0 <= y < recipe['height']:
            raise ValueError('Placement cell is outside footprint')
        point['cell'] = {'x': x, 'y': y}
    return points
