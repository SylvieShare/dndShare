#!/usr/bin/env python3
"""Read the supplied PHB by visual columns, preserving headings and page origin.

The PDF drawing order is not its reading order (notably Ranger p.160). Do not
use a plain concatenation of PDF text objects for rules publication.
"""
import argparse, json, re
from pathlib import Path
import pdfplumber

def extract(path):
    pages = []
    with pdfplumber.open(path) as pdf:
        for number, page in enumerate(pdf.pages):
            if number not in range(51, 388):
                pages.append([])
                continue
            words = page.extract_words()
            # Class progression tables occupy both columns. Their source text is
            # extracted separately, so it cannot interrupt a feature paragraph.
            table_top, table_bottom = None, None
            if 51 <= number < 176:
                title = next((w for w in words if w['text'] == 'умеНия'), None)
                last = [w for w in words if w['text'] == '20' and w['x0'] < 100]
                if title and last:
                    table_top, table_bottom = title['top'] - 2, max(w['bottom'] for w in last) + 3
            blocks = []
            for x0, x1 in [(35, page.width / 2), (page.width / 2, page.width - 35)]:
                crop = page.crop((x0, 40, x1, page.height - 40))
                if table_top is not None:
                    crop = crop.filter(lambda obj: obj.get('top', 0) < table_top or obj.get('top', 0) > table_bottom)
                for line in crop.extract_text_lines():
                    chars = line['chars']
                    if not chars:
                        continue
                    font = max(set(c['fontname'] for c in chars), key=lambda f: sum(c['fontname'] == f for c in chars))
                    size = max(c['size'] for c in chars)
                    # Illustration captions use a different display font.
                    if 'AlegreyaSans' in font or 'SpectralSC' in font:
                        continue
                    kind = 'heading' if 'AlegreyaSC' in font else 'text'
                    text = line['text'].strip()
                    if not text:
                        continue
                    if blocks and kind == blocks[-1]['kind'] and abs(blocks[-1]['size'] - size) < .2 and line['top'] - blocks[-1]['bottom'] < 8:
                        blocks[-1]['text'] += '\n' + text
                        blocks[-1]['bottom'] = line['bottom']
                    else:
                        blocks.append({'kind': kind, 'size': round(size, 1), 'text': text, 'bottom': line['bottom']})
                # A paragraph may continue in the next column, but heading
                # merging across columns would combine two different features.
                if blocks:
                    blocks[-1]['bottom'] = -100
            pages.append([{k: v for k, v in b.items() if k != 'bottom'} for b in blocks])
            if number % 50 == 0:
                print(f'page {number + 1}', flush=True)
    return pages

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('pdf'); parser.add_argument('output')
    args = parser.parse_args()
    Path(args.output).write_text(json.dumps(extract(args.pdf), ensure_ascii=False, indent=2) + '\n')
