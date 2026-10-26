#!/usr/bin/env python3
"""Generate CSS, JS media queries and Compose metrics from one product contract."""
import argparse
from token_model import ROOT, SOURCE, digest, load
from token_render import manifest, render


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    source_hash = digest(SOURCE.read_bytes())
    outputs = render(load(), source_hash)
    outputs['design/generated.json'] = manifest(source_hash, outputs)
    stale = []
    for name, content in outputs.items():
        path = ROOT / name
        if args.check:
            if not path.is_file() or path.read_text(encoding='utf-8') != content:
                stale.append(name)
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding='utf-8')
    if stale:
        raise SystemExit('Run python3 scripts/design/tokens.py:\n' + '\n'.join(stale))
    print('Shared design tokens match CSS/Compose' if args.check else 'Shared design tokens generated')


if __name__ == '__main__':
    main()
