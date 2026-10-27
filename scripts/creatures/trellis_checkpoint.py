"""Durable, private stage receipts; no credentials and no implicit GPU replay."""
from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import tempfile
import uuid


def digest(data):
    return hashlib.sha256(data).hexdigest()


def atomic_write(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(dir=path.parent, prefix='.'+path.name)
    try:
        with os.fdopen(fd, 'wb') as output:
            output.write(data)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def write_json(path, value):
    atomic_write(path, (json.dumps(value, indent=2)+'\n').encode())


@contextmanager
def output_lock(folder):
    import fcntl  # Only the POSIX queue takes locks; Windows Blender reads hashes.

    folder.mkdir(parents=True, exist_ok=True)
    with (folder/'.trellis.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError('Another process is using this output folder') from None
        yield


class Checkpoint:
    def __init__(self, folder, identity=None):
        self.folder = Path(folder)
        self.path = self.folder/'trellis-checkpoint.json'
        if self.path.exists():
            self.data = json.loads(self.path.read_text())
            if self.data.get('schema') != 1 or (identity is not None and self.data['identity'] != identity):
                raise ValueError('Input or generation settings changed; use a new output folder')
        else:
            if identity is None:
                raise ValueError('No resumable checkpoint in this output folder')
            if any((self.folder/name).exists() for name in ['generated-original.glb', 'generation.json', 'generation-preview.html']):
                raise ValueError('Existing generation has no resumable checkpoint; use a new output folder')
            self.data = {'schema': 1, 'identity': identity, 'sessionHash': uuid.uuid4().hex,
                         'steps': {}, 'files': {}}
            self.save()

    def save(self):
        write_json(self.path, self.data)

    def file(self, key):
        entry = self.data['files'].get(key)
        if entry is None:
            return None
        path = self.folder/entry['name']
        if not path.is_file() or digest(path.read_bytes()) != entry['sha256']:
            raise ValueError('Local generation artifact is missing or changed: '+entry['name'])
        return path

    def remember(self, key, path):
        self.data['files'][key] = {'name': path.name, 'sha256': digest(path.read_bytes())}
        self.save()

    def step(self, name, remote, arguments):
        record = self.data['steps'].get(name)
        receipt = self.folder/'trellis-results'/(name+'.json')
        # A completion receipt is written before advancing the checkpoint. This
        # also recovers an interruption between those two atomic file writes.
        if receipt.exists():
            if record and record.get('resultSHA256') and digest(receipt.read_bytes()) != record['resultSHA256']:
                raise ValueError('Stage receipt changed: '+name)
            value = json.loads(receipt.read_text())
            if value['sessionHash'] != self.data['sessionHash'] or value['stage'] != name:
                raise ValueError('Stage receipt belongs to another generation')
            self.data['steps'][name] = dict(record or {}, status='complete', resultSHA256=digest(receipt.read_bytes()))
            self.save()
            return value['output']
        if record and record['status'] == 'complete':
            raise ValueError('Missing completed-stage receipt: '+name)
        if record and record['status'] == 'submitting':
            raise RuntimeError('Submission outcome unknown for '+name+'; refusing a duplicate job')
        if record and record['status'] == 'failed' and name == 'image_to_3d':
            raise RuntimeError('Generation failed; a new GPU attempt requires a new output folder')
        if record and record.get('errorKind') == 'session-unavailable':
            raise RuntimeError('Provider session expired; a new generation requires a new output folder')
        if not record or record['status'] in ('failed', 'not-submitted'):
            arguments = arguments() if callable(arguments) else arguments
            if hasattr(remote, 'payload'):
                remote.payload(name, arguments)  # Validate before marking a POST as uncertain.
            self.data['steps'][name] = record = {'status': 'submitting'}
            self.save()
            # A POST is never retried automatically: a lost response could hide
            # an accepted, billable job. Only an acknowledged event can resume.
            try:
                event_id = remote.submit(name, arguments)
            except TerminalJobError as error:
                if error.kind == 'request-rejected':
                    record.update(status='not-submitted', errorKind=error.kind)
                    self.save()
                raise
            record.update(status='pending', eventId=event_id)
            self.save()
        try:
            output = remote.result(name, record['eventId'])
        except TerminalJobError as error:
            record.update(status='failed', errorKind=error.kind)
            self.save()
            raise
        write_json(receipt, {'sessionHash': self.data['sessionHash'], 'stage': name, 'output': output})
        record.update(status='complete', resultSHA256=digest(receipt.read_bytes()))
        record.pop('errorKind', None)
        self.save()
        return output

    def status(self):
        # Session/event IDs and remote file URLs stay out of console reports.
        return {'steps': {k: {'status': v['status'], **({'errorKind': v['errorKind']} if 'errorKind' in v else {})}
                          for k, v in self.data['steps'].items()}, 'files': list(self.data['files'])}


class TerminalJobError(RuntimeError):
    def __init__(self, kind):
        self.kind = kind
        super().__init__('Remote job failed: '+kind+'; checkpoint preserved, generation not repeated')
