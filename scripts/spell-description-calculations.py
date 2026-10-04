#!/usr/bin/env python3
"""Prepare reviewed rich calculation inserts; publish the plan with spell-rules/apply.py."""
import argparse
import html
import json
import re
from pathlib import Path
from urllib.parse import quote


def text_positions(source):
    """Map visible characters back to HTML offsets, preserving inline markup/entities."""
    text, ends = [], []
    for match in re.finditer(r'<[^>]*>|&(?:#\d+|#x[\da-fA-F]+|[a-zA-Z]+);|[^<&]+|[<&]', source):
        token = match.group()
        if token.startswith('<') and token.endswith('>'):
            continue
        decoded = html.unescape(token)
        text.append(decoded)
        if decoded != token:
            ends.extend([match.end()] * len(decoded))
        else:
            ends.extend(range(match.start() + 1, match.end() + 1))
    return ''.join(text), ends


def insert_calculations(source, specifications):
    for spec in specifications:
        payload = quote(json.dumps({'formula': spec['formula'], 'label': spec['label']},
                                   ensure_ascii=False, separators=(',', ':')), safe='')
        node = f'<span data-rich-node="calculation" data-rich-payload="{payload}" contenteditable="false">{html.escape(spec["label"])}</span>'
        visible, ends = text_positions(source)
        phrase = spec['after']
        if visible.count(phrase) != 1:
            raise ValueError(f'Expected one anchor: {phrase!r}')
        end = ends[visible.index(phrase) + len(phrase) - 1]
        # Keep a calculation outside the inline emphasis/reference containing the anchor.
        closing = re.match(r'(?:</(?:span|strong|em|b|i|u)>)*', source[end:])
        end += closing.end()
        if source[end:].startswith(' ' + node):
            continue
        source = source[:end] + ' ' + node + source[end:]
    return source


def prepare(catalogue, specifications):
    by_id = {item['id']: item for item in catalogue}
    grouped = {}
    for spec in specifications:
        grouped.setdefault(spec['id'], []).append(spec)
    plan = []
    for item_id, inserts in grouped.items():
        item = by_id[item_id]
        if item.get('userId') is not None or item['typeId'] != 5:
            raise ValueError(f'Expected a shared spell: {item_id}')
        before = item['data']['description']
        after = insert_calculations(before, inserts)
        if after != before:
            plan.append({'id': item_id, 'name': item['name'],
                         'changes': {'description': {'before': before, 'after': after}}})
    return plan


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('catalogue', type=Path)
    parser.add_argument('plan', type=Path)
    args = parser.parse_args()
    specifications = json.loads(Path(__file__).with_name('spell-description-calculations.json').read_text())
    plan = prepare(json.loads(args.catalogue.read_text()), specifications)
    args.plan.write_text(json.dumps(plan, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'spells': len(plan), 'calculations': len(specifications)}, ensure_ascii=False))
