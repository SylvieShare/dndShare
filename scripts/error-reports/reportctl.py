"""Report-only MCP client for the local chat. Lease handles stay outside its transcript."""
import argparse
import base64
import json
from pathlib import Path
import sys

from state import write_json
from transport import Client, ProtocolError, load_config


class Reports:
    def __init__(self, config):
        self.client = Client(config)
        self.root = Path(config['stateDirectory']) / 'agent'
        self.root.mkdir(parents=True, exist_ok=True)
        self.lease_file = self.root / 'lease.json'

    def lease(self):
        if not self.lease_file.is_file(): raise ProtocolError('Acquire a report lease first')
        return json.loads(self.lease_file.read_text(encoding='utf-8'))

    def owned(self, name, arguments=None):
        args = dict(arguments or {}, leaseId=self.lease()['leaseId'])
        return self.client.value(name, args)

    def acquire(self):
        if self.lease_file.is_file():
            result = self.owned('error_report_lock_renew', {'ttlMinutes': 45})
            if result.get('renewed') is True:
                return {'acquired': True, 'resumed': True, 'claimedIds': self.lease().get('claimedIds', []), 'expiresAt': result['expiresAt']}
        result = self.client.value('error_report_lock_acquire', {'ttlMinutes': 45})
        if result.get('acquired') is True:
            if not result.get('leaseId') or not result.get('expiresAt'): raise ProtocolError('Invalid lease receipt')
            write_json(self.lease_file, {'leaseId': result['leaseId'], 'claimedIds': []})
        return {key: value for key, value in result.items() if key != 'leaseId'}

    def image(self, report_id, kind):
        result = self.client.call('error_report_screenshot', {'id': report_id, 'kind': kind})
        images = [entry for entry in result.get('content', []) if entry.get('type') == 'image']
        if len(images) != 1: raise ProtocolError('Expected one report screenshot')
        entry = images[0]
        extensions = {'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp'}
        if entry.get('mimeType') not in extensions: raise ProtocolError('Unexpected screenshot MIME')
        data = base64.b64decode(entry['data'], validate=True)
        if len(data) > 2 * 1024 * 1024: raise ProtocolError('Screenshot is too large')
        path = self.root / f"report-{report_id}-{kind}{extensions[entry['mimeType']]}"
        path.write_bytes(data)
        return {'path': str(path.resolve()), 'mimeType': entry['mimeType']}

    def execute(self, args):
        action = args.action
        if action == 'list':
            return self.client.value('error_reports_list', {'limit': 500, 'offset': args.offset, 'compact': True})
        if action == 'get': return self.client.value('error_report_get', {'id': args.id})
        if action == 'image': return self.image(args.id, args.kind)
        if action == 'acquire': return self.acquire()
        if action == 'status':
            return {'hasLease': self.lease_file.is_file(), 'claimedIds': self.lease().get('claimedIds', []) if self.lease_file.is_file() else []}
        if action == 'renew': return self.owned('error_report_lock_renew', {'ttlMinutes': 45})
        if action == 'release':
            result = self.owned('error_report_lock_release')
            if result.get('released') is True: self.lease_file.unlink()
            return result
        if action == 'claim':
            result = self.owned('error_reports_claim', {'ids': args.ids})
            if sorted(result.get('claimedIds', [])) != sorted(set(args.ids)): raise ProtocolError('Claim batch did not match')
            lease = self.lease(); lease['claimedIds'] = result['claimedIds']; write_json(self.lease_file, lease)
            return result
        text = Path(args.text_file).read_text(encoding='utf-8-sig').strip()
        tools = {'title': ('error_report_title_set', 'title'), 'question': ('error_report_question_create', 'question'),
                 'serious': ('error_report_serious_change_request', 'reason'), 'resolve': ('error_report_resolve', 'resolution')}
        tool, field = tools[action]
        arguments = {'id': args.id, field: text}
        if action == 'resolve': arguments['commitSha'] = args.commit
        result = self.owned(tool, arguments)
        if action in {'question', 'serious', 'resolve'}:
            lease = self.lease(); lease['claimedIds'] = [value for value in lease.get('claimedIds', []) if value != args.id]
            write_json(self.lease_file, lease)
        return result


def parser():
    root = argparse.ArgumentParser(description=__doc__)
    root.add_argument('--config', required=True)
    sub = root.add_subparsers(dest='action', required=True)
    listing = sub.add_parser('list'); listing.add_argument('--offset', type=int, default=0)
    for name in ('acquire', 'renew', 'release', 'status'): sub.add_parser(name)
    claim = sub.add_parser('claim'); claim.add_argument('ids', type=int, nargs='+')
    for name in ('get', 'image', 'title', 'question', 'serious', 'resolve'):
        command = sub.add_parser(name); command.add_argument('id', type=int)
        if name == 'image': command.add_argument('--kind', choices=('element', 'viewport'), default='element')
        if name in ('title', 'question', 'serious', 'resolve'): command.add_argument('--text-file', required=True)
        if name == 'resolve': command.add_argument('--commit', required=True)
    return root


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
    args = parser().parse_args()
    try:
        print(json.dumps(Reports(load_config(args.config)).execute(args), ensure_ascii=False, indent=2))
    except Exception as error:
        # Never echo capabilities, HTTP headers or full response objects.
        print(json.dumps({'error': type(error).__name__, 'message': str(error) if isinstance(error, ProtocolError) else 'Report operation failed'}, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)
