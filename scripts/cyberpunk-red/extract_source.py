"""Extract the user-provided RU PDF into ignored working files, never into runtime.

The supplied file lacks usable Unicode maps in several embedded fonts. The
mapping below is specific to this SHA; table values still require visual review.
"""
import argparse
import hashlib
import json
from pathlib import Path

import pymupdf

EXPECTED_SHA = "aece6513e81347acecb06e1544ec281d44b9eed2e99ec7c4ecfc766b6856b295"


def decode(font, glyph, unicode_value, shifted=False):
    if unicode_value != 65533:
        return chr(unicode_value)
    if "Futura" in font:
        shift = 2 if shifted else 0
        glyph += shift
        if 348 <= glyph <= 411:
            return chr(glyph + 692)
        if glyph == 334:
            return "Ё"
        if glyph == 412:
            return "ё"
        if 3 <= glyph <= 97:
            return chr(glyph + 29)
        return {514: "—", 109: "«", 125: "»", 127: "×", 7593: "▶", 7592: "◀"}.get(glyph, f"⟦{glyph}⟧")
    if "Bisect" in font:
        if 118 <= glyph <= 181:
            return chr(glyph + 922)
        if glyph == 4:
            return " "
        if 18 <= glyph <= 27:
            return chr(glyph + 30)
    if font in {"Arial,Bold", "ArialMT"} and 570 <= glyph <= 633:
        return chr(glyph + 470)
    if "IndustryInc" in font and 3 <= glyph <= 97:
        return chr(glyph + 29)
    return {7593: "▶", 7592: "◀", 220: "•"}.get(glyph, f"⟦{glyph}⟧")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--render", default="3,42,74,78,79,86,87,88,90,91,92,96,98,103,104,105,117")
    args = parser.parse_args()
    actual = hashlib.sha256(args.source.read_bytes()).hexdigest()
    if actual != EXPECTED_SHA:
        raise SystemExit("This font mapping is only reviewed for the recorded source SHA")
    args.output.mkdir(parents=True, exist_ok=True)
    doc = pymupdf.open(args.source)
    rows = []
    for page in doc:
        spans = []
        traces = page.get_texttrace()
        shifted = {s['font'] for s in traces if 'Futura' in s['font']
                   and any(u == 65533 and g == 1 for u, g, *_ in s['chars'])}
        for span in traces:
            text = "".join(decode(span["font"], glyph, unicode_value, span['font'] in shifted)
                           for unicode_value, glyph, *_ in span["chars"])
            if text.strip():
                spans.append({"bbox": span["bbox"], "font": span["font"], "text": text})
        rows.append(spans)
    (args.output / "spans.json").write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
    (args.output / "decoded.txt").write_text("\n".join(
        f"\n=== PAGE {i} ===\n" + "\n".join(s["text"] for s in row)
        for i, row in enumerate(rows)), encoding="utf-8")
    for index in map(int, args.render.split(",")):
        doc[index].get_pixmap(matrix=pymupdf.Matrix(1.5, 1.5)).save(args.output / f"page-{index:03}.png")
    print(json.dumps({"sha256": actual, "pages": len(doc), "output": str(args.output)}))


if __name__ == "__main__":
    main()
