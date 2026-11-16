"""Refresh coverage from actual batch receipts, without counting type fallbacks as item art."""
import argparse
import json
from pathlib import Path


def identity(row, target=False):
    kind = row['kind']
    if kind == 'suggest':
        return kind, row['typeId'], row['id']
    return kind, row['typeId'] if target and kind in ('item_type', 'suggest_type') else row['id']


def refresh(directory):
    queue_file = directory / 'queue.json'
    queue = json.loads(queue_file.read_text(encoding='utf-8'))
    rows = {(identity(row), row['slot']): row for row in queue['queue']}
    for file in sorted(directory.glob('batch-*.json')):
        batch = json.loads(file.read_text(encoding='utf-8'))
        for asset in batch['assets']:
            row = rows[(identity(asset['target'], True), asset['slot'])]
            state = asset['status']
            if state == 'exported' and asset.get('visualReview', {}).get('passed'):
                state = 'ready'
            row.update(status=state, batch=batch['batch'])
            for key in ('sha256', 'url'):
                if key in asset:
                    row[key] = asset[key]
    queue['progress'] = {'publishedSlots': sum(r['status'] == 'published' for r in rows.values()),
                         'readySlots': sum(r['status'] == 'ready' for r in rows.values()),
                         'totalSlots': len(rows)}
    queue_file.write_text(json.dumps(queue, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return queue['progress']


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('directory', type=Path)
    print(refresh(parser.parse_args().directory))
