"""Classify source wall shapes into the editor's concrete tile types."""
import re


def tile_category(kind, name, mode, mask, shape):
    text = name.lower()
    if 'bridge' in text: return 'bridge'
    if any(word in text for word in ['door','passage','archway','entrance','gate']): return 'passage'
    if any(word in text for word in ['column','pillar']): return 'column'
    if kind == 'prop': return 'floor'
    if kind != 'wall': return kind
    if shape == 'corner' and mode == 'center' and mask.bit_count() == 1:
        return 'wall-end'
    text = name.lower()
    for word, category in [('diagonal', 'diagonal'), ('corner', 'corner'),
                           ('angle', 'angle'), ('t-shaped', 'tee'), ('x-shaped', 'cross')]:
        if word in text:
            return 'wall-' + category
    if re.search(r'\b(end|ending|cap)\b', text):
        return 'wall-end'
    if shape in ['straight', 'angle', 'tee', 'cross']:
        return 'wall-' + shape
    return 'wall-straight'
