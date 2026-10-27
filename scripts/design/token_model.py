"""Validated product design contract. Units: CSS px/Android dp; text uses sp on Android."""
import hashlib
import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'design/tokens.json'
GROUPS = {'layout', 'spacing', 'radius', 'collection', 'canvas', 'list', 'motion'}
FAMILIES = {'display', 'prose', 'ui'}
# Match the ranges declared by local @font-face and native font resources.
FONT_WEIGHTS = {'display': (500, 700), 'prose': (400, 700), 'ui': (100, 900)}
KEY = re.compile(r'^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$')
REQUIRED = {
    'layout': {'tablet', 'desktop', 'sidebar-collapsed', 'sidebar-expanded', 'drawer', 'content-max', 'header', 'border', 'touch-min',
               'sheet-max', 'sheet-stat-min', 'sheet-base-min', 'sheet-stats-column', 'sheet-utilities-column',
               'morph-stacked-max', 'morph-editor-width', 'morph-preview-min', 'morph-margin'},
    'collection': {'min-height', 'padding', 'emblem', 'art-inset', 'grid-gap'},
    'canvas': {'step', 'radius', 'opacity'},
    'spacing': {'xs', 'compact', 'small', 'label', 'medium', 'large', 'page', 'section'},
    'list': {'min-height', 'icon', 'gap', 'padding-end', 'metric-min', 'metric-max', 'metric-padding-max', 'body-top', 'body-bottom', 'row-margin', 'row-gap'},
    'motion': {'enter', 'exit', 'navigation', 'feedback', 'distance', 'morph-open', 'morph-close'},
    'radius': {'xs', 'small', 'medium', 'large', 'xl', 'tile', 'badge', 'row', 'morph'},
}


def normalized(data):
    return data.replace(b'\r\n', b'\n')


def digest(data):
    return hashlib.sha256(normalized(data)).hexdigest()


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f'Duplicate design token: {key}')
        result[key] = value
    return result


def load(path=SOURCE):
    return validate(json.loads(path.read_text(encoding='utf-8'), object_pairs_hook=unique_object))


def validate(data):
    if set(data) != GROUPS | {'schemaVersion', 'colors', 'typography'} or data['schemaVersion'] != 1:
        raise ValueError('Unsupported design token schema')
    if set(data['colors']) != {'accent', 'accent-hover', 'accent-soft'}:
        raise ValueError('Product colors must define the three accent roles')
    for key, value in data['colors'].items():
        if not isinstance(value, str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', value):
            raise ValueError(f'Invalid color: {key}')
    for group in GROUPS:
        if set(data[group]) != REQUIRED[group]:
            raise ValueError(f'Unexpected or missing {group} tokens')
        for key, value in data[group].items():
            number(value, f'{group}.{key}')
    layout = data['layout']
    if layout['tablet'] >= layout['desktop'] or layout['sidebar-collapsed'] >= layout['sidebar-expanded']:
        raise ValueError('Invalid window/rail ordering')
    if layout['touch-min'] < 48 or data['collection']['min-height'] <= 2 * data['collection']['padding']:
        raise ValueError('Touch target or tile content cannot fit')
    if data['list']['metric-min'] > data['list']['metric-max'] or data['list']['icon'] > data['list']['min-height']:
        raise ValueError('Invalid list geometry')
    if any(not isinstance(value, int) for key, value in data['motion'].items() if key != 'distance'):
        raise ValueError('Motion durations must be whole milliseconds')
    if not 0 < data['canvas']['opacity'] <= 1:
        raise ValueError('Canvas opacity must be in (0,1]')
    if not data['typography']:
        raise ValueError('Typography roles cannot be empty')
    for name, role in data['typography'].items():
        if not KEY.fullmatch(name) or set(role) != {'family', 'size', 'lineHeight', 'weight', 'tracking'}:
            raise ValueError(f'Invalid typography role: {name}')
        if role['family'] not in FAMILIES:
            raise ValueError(f'Unknown font family: {name}')
        number(role['size'], name)
        number(role['lineHeight'], name)
        tracking = role['tracking']
        if isinstance(tracking, bool) or not isinstance(tracking, (int, float)) or not math.isfinite(tracking) or not -role['size'] / 2 <= tracking <= role['size']:
            raise ValueError(f'Invalid font tracking: {name}')
        if role['lineHeight'] < role['size'] or role['weight'] not in range(100, 901, 100):
            raise ValueError(f'Invalid font metrics: {name}')
        low, high = FONT_WEIGHTS[role['family']]
        if not low <= role['weight'] <= high:
            raise ValueError(f'{role["family"].capitalize()} font supports weights {low}–{high}: {name}')
    return data


def number(value, name):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0:
        raise ValueError(f'Invalid positive token: {name}')


def literal(value):
    return format(value, 'g')


def pascal(name):
    return ''.join(word.capitalize() for word in name.split('-'))


def media_queries(data):
    tablet, desktop = (literal(data['layout'][name]) for name in ['tablet', 'desktop'])
    return {
        '--ui-phone': f'(width < {tablet}px)',
        '--ui-tablet': f'({tablet}px <= width < {desktop}px)',
        '--ui-compact': f'(width < {desktop}px)',
        '--ui-desktop': f'(width >= {desktop}px)',
        '--ui-from-tablet': f'(width >= {tablet}px)',
        '--ui-morph-stacked': f'(width <= {literal(data["layout"]["morph-stacked-max"])}px)',
    }
