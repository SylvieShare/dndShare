"""Prepare review rows from the supplied PDF. Output remains outside the repository."""
import importlib.util
import json
from pathlib import Path
import re
import pymupdf

spec = importlib.util.spec_from_file_location('source', Path(__file__).with_name('extract_source.py'))
source = importlib.util.module_from_spec(spec)
spec.loader.exec_module(source)


def characters(page):
    spans = page.get_texttrace()
    shifted = {s['font'] for s in spans if 'Futura' in s['font'] and any(u == 65533 and g == 1 for u, g, *_ in s['chars'])}
    out = []
    for span in spans:
        for uni, glyph, origin, box in span['chars']:
            out.append({'text': source.decode(span['font'], glyph, uni, span['font'] in shifted),
                        'x': (box[0] + box[2]) / 2, 'y': origin[1], 'font': span['font']})
    return out


def lines(chars):
    rows = []
    for char in sorted(chars, key=lambda c: (round(c['y'], 1), c['x'])):
        row = next((r for r in rows if abs(r['y'] - char['y']) < 2), None)
        if row is None:
            row = {'y': char['y'], 'chars': []}
            rows.append(row)
        row['chars'].append(char)
    return [{'y': r['y'], 'text': ''.join(c['text'] for c in sorted(r['chars'], key=lambda c: c['x'])).strip()}
            for r in rows]


def cyber_rows(page, number):
    chars = characters(page)
    names = lines([c for c in chars if 74 < c['x'] < 154 and 100 < c['y'] < 735 and c['font'] in ['FuturaPT,Bold','FuturaPT-Bold']])
    grouped = []
    for line in names:
        if not line['text'] or line['text'] in ['Название', 'Цена', 'ПЧ']: continue
        if grouped and line['y'] - grouped[-1]['lastY'] < 14:
            grouped[-1]['name'] += ' ' + line['text']; grouped[-1]['lastY'] = line['y']
        else: grouped.append({'name': line['text'], 'y': line['y'], 'lastY': line['y']})
    for i, row in enumerate(grouped):
        mid = (row['y'] + row['lastY']) / 2
        low = (grouped[i-1]['lastY'] + row['y']) / 2 if i else max(100,row['y']-25)
        high = (row['lastY'] + grouped[i+1]['y']) / 2 if i+1<len(grouped) else min(735,row['lastY']+35)
        selected = [c for c in chars if low < c['y'] < high]
        row['page'] = number
        row['text'] = ' '.join(r['text'] for r in lines([c for c in selected if 154<c['x']<452]))
        row['priceText'] = ' '.join(r['text'] for r in lines([c for c in selected if 452<c['x']<507]))
        row['humanityText'] = ' '.join(r['text'] for r in lines([c for c in selected if 507<c['x']<550]))
        row['price'] = re.findall(r'([0-9,]+)\s*eb', row['priceText'])
    return grouped


if __name__ == '__main__':
    doc = pymupdf.open('C:/Projects/dndshare/docs/cyberpunk-red-core-rulebook-1.25-ru.pdf')
    result = [row for n in range(358,370) for row in cyber_rows(doc[n],n)]
    Path('C:/Projects/dndshare/build/cyberpunk-red-source/cyber-rows.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    for r in result: print(r['page'], r['name'], r['priceText'], r['humanityText'])
