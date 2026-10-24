"""Persistent model build stages and conservative GPU reservations."""
import hashlib
import json
from pathlib import Path
import time

from trellis_checkpoint import TerminalJobError, write_json


class QuotaStop(TerminalJobError):
    def __init__(self, message):
        self.kind = 'request-rejected'  # The budget gate ran before any POST.
        RuntimeError.__init__(self,message)


def file_hash(path):
    result = hashlib.sha256()
    with Path(path).open('rb') as source:
        for chunk in iter(lambda: source.read(1024*1024), b''):
            result.update(chunk)
    return result.hexdigest()


def native_directory(folder, attempt=1):
    if not isinstance(attempt,int) or not 1 <= attempt <= 20:
        raise ValueError('Invalid explicit native attempt')
    return Path(folder)/('trellis-native' if attempt == 1 else f'trellis-native-{attempt}')


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


class BuildQueue:
    def __init__(self, manifest, root):
        self.manifest, self.root = manifest, Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self.path = self.root/'production-state.json'
        entries = manifest['entries']
        if manifest.get('schema') != 1 or not entries or len({e['slug'] for e in entries}) != len(entries):
            raise ValueError('Invalid production manifest')
        if any(Path(e['slug']).name != e['slug'] or e['slug'] in ('.','..') for e in entries):
            raise ValueError('Invalid model slug')
        if len({e['itemId'] for e in entries}) != len(entries):
            raise ValueError('Choose one canonical item per pilot model')
        if manifest['budget'].get('allowPaidOverquota') is not False:
            raise ValueError('Paid overquota is not supported by this queue')
        if self.path.exists():
            self.data = json.loads(self.path.read_text())
            if self.data.get('schema') != 1:
                raise ValueError('Unsupported build queue state')
        else:
            self.data = {'schema':1,'gpuCalls':0,'generations':0,'jobs':{}}
        for entry in entries:
            old = self.data['jobs'].setdefault(entry['slug'], {'itemId':entry['itemId'],'stages':{},'status':'pending'})
            if old['itemId'] != entry['itemId']:
                raise ValueError('A queued slug cannot change its item')
        self.data['manifestSHA256'] = fingerprint(manifest)
        self.save()

    def save(self):
        write_json(self.path,self.data)

    def stage(self, entry, name, inputs, action):
        job = self.data['jobs'][entry['slug']]
        key = fingerprint(inputs)
        old = job['stages'].get(name)
        if old and old['status'] == 'complete' and old['inputSHA256'] == key:
            if not all((self.root/p).is_file() and file_hash(self.root/p) == sha for p,sha in old['outputs'].items()):
                raise ValueError('Completed stage output changed: '+entry['slug']+'/'+name)
            return False
        stage = {'status':'running','inputSHA256':key,'attempts':(old or {}).get('attempts',0)+1,
                 'startedAt':time.time(),'elapsedSeconds':(old or {}).get('elapsedSeconds',0)}
        job['stages'][name], job['status'] = stage, name
        self.save()
        started = time.monotonic()
        print(json.dumps({'model':entry['slug'],'stage':name,'status':'running'}),flush=True)
        try:
            outputs = [Path(p).resolve() for p in action()]
            if not outputs or any(not p.is_file() or not p.is_relative_to(self.root) for p in outputs):
                raise ValueError('Stage must produce files inside its workspace')
            stage.update(status='complete',outputs={str(p.relative_to(self.root)):file_hash(p) for p in outputs})
            job['status'] = name+'-complete'
        except Exception as error:
            stage.update(status='paused' if isinstance(error,QuotaStop) else 'failed',errorType=type(error).__name__)
            job['status'] = stage['status']
            raise
        finally:
            stage['elapsedSeconds'] += round(time.monotonic()-started,3)
            stage['finishedAt'] = time.time()
            self.save()
            print(json.dumps({'model':entry['slug'],'stage':name,'status':stage['status'],'seconds':stage['elapsedSeconds']}),flush=True)
        return True

    def reserve_gpu(self, entry, endpoint, quota):
        limits = self.manifest['budget']
        if quota.remaining < limits['minRemainingGpuSeconds'] or (quota.overquota_used or 0) > 0:
            raise QuotaStop('Included GPU quota is too low; queue paused before submission')
        if self.data['gpuCalls'] >= limits['maxGpuCalls']:
            raise QuotaStop('Pilot GPU-call limit reached')
        if endpoint == 'image_to_3d' and self.data['generations'] >= limits['maxGenerations']:
            raise QuotaStop('Pilot generation limit reached')
        self.data['gpuCalls'] += 1
        if endpoint == 'image_to_3d':
            self.data['generations'] += 1
        job = self.data['jobs'][entry['slug']]
        job.setdefault('gpuReservations',[]).append({'stage':endpoint,'at':time.time(),
            'remainingBefore':quota.remaining,'base':quota.base})
        self.save()

    def summary(self):
        return self.summarize(self.data)

    @staticmethod
    def summarize(data):
        return {'gpuCalls':data['gpuCalls'],'generations':data['generations'],
                'jobs':[{ 'slug':slug,'itemId':j['itemId'],'status':j['status'],
                    'stages':{s:r['status'] for s,r in j['stages'].items()}}
                    for slug,j in data['jobs'].items()]}
