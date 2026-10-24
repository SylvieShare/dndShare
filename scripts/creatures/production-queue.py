#!/usr/bin/env python3
"""Run reviewed creature references through a resumable, budgeted build queue."""
import argparse
import getpass
import json
import os
from pathlib import Path
import runpy
import sys
import time

from model_build_queue import BuildQueue, QuotaStop, file_hash, native_directory
from trellis_checkpoint import Checkpoint, output_lock
from trellis_transport import TrellisRemote

ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = runpy.run_path(str(Path(__file__).with_name('generate-trellis.py')))['workflow']


class BudgetRemote(TrellisRemote):
    def __init__(self, session, token, api, queue, entry):
        super().__init__(session,token)
        self.api, self.queue, self.entry = api, queue, entry

    def submit(self,name,arguments):
        if name in ['image_to_3d','extract_glb']:
            self.queue.reserve_gpu(self.entry,name,self.api.get_zero_gpu_quota())
        return super().submit(name,arguments)


def native(queue, entry, credentials):
    folder = queue.root/entry['slug']
    reference = folder/'miniature-reference.png'
    review_file = folder/'reference-review.json'
    if not reference.is_file() or not review_file.is_file():
        return None
    image_sha = file_hash(reference)
    review = json.loads(review_file.read_text())
    if not review.get('approved') or review['imageSHA256'] != image_sha:
        raise ValueError('Reference needs review: '+entry['slug'])
    settings = {'seed':entry.get('seed',entry['itemId']),'resolution':'1024','decimationTarget':300000,'textureSize':2048}
    attempt = entry.get('nativeAttempt',1)

    def build():
        output = native_directory(folder,attempt)
        output.mkdir(exist_ok=True)
        with output_lock(output):
            cp = Checkpoint(output,{'provider':'microsoft/TRELLIS.2','imageSHA256':image_sha,'settings':settings})
            def remote(session):
                token,api = credentials()
                return BudgetRemote(session,token,api,queue,entry)
            WORKFLOW(cp,reference,remote)
        return [output/'generated-original.glb',output/'generation.json']
    return queue.stage(entry,'native',{'reference':image_sha,'settings':settings,'attempt':attempt},build)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest',type=Path)
    parser.add_argument('--workdir',type=Path,required=True)
    parser.add_argument('--run',action='store_true',help='Default is a local status read')
    parser.add_argument('--until',choices=['native','ready','published'],default='native')
    parser.add_argument('--only',help='Comma-separated slugs')
    parser.add_argument('--watch',action='store_true',help='Wait for reviewed references during this run')
    parser.add_argument('--idle-timeout',type=int,default=600)
    parser.add_argument('--token-stdin',action='store_true')
    parser.add_argument('--token-fd',type=int,help='Read the token once from an inherited pipe; never a command argument')
    parser.add_argument('--server-token',action='store_true',help='Use the previously authorized project MCP token for publication')
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text())
    if not args.run:
        path = args.workdir/'production-state.json'
        print(json.dumps(BuildQueue.summarize(json.loads(path.read_text())) if path.exists() else {'status':'not-started'},ensure_ascii=False,indent=2))
        return 0
    with output_lock(args.workdir):
        queue = BuildQueue(manifest,args.workdir)
        credentials_cache = None
        def credentials():
            nonlocal credentials_cache
            if credentials_cache is None:
                from huggingface_hub import HfApi
                if args.token_fd is not None:
                    with os.fdopen(args.token_fd,'r') as source: token = source.readline().strip()
                elif args.token_stdin:
                    token = getpass.getpass('HF token (memory only): ')
                else:
                    raise RuntimeError('An authorized personal HF token is required for new GPU work')
                api = HfApi(token=token)
                if api.whoami().get('type') != 'user':
                    raise RuntimeError('A personal account is required')
                credentials_cache = (token,api)
            return credentials_cache
        entries = manifest['entries']
        if args.only:
            selected = set(args.only.split(','))
            if not selected <= {e['slug'] for e in entries}: raise ValueError('Unknown model slug')
            entries = [e for e in entries if e['slug'] in selected]
        idle = time.monotonic()
        while True:
            progress, waiting = False,False
            for entry in entries:
                try:
                    result = native(queue,entry,credentials)
                    if result is None:
                        waiting = True
                        continue
                    progress |= result
                    if args.until != 'native':
                        from production_stages import process
                        progress |= process(queue,entry,args.until,args.server_token)
                except QuotaStop:
                    raise
                except Exception as error:
                    print(json.dumps({'model':entry['slug'],'failed':type(error).__name__}),flush=True)
            if not args.watch or not waiting:
                break
            if progress: idle = time.monotonic()
            if time.monotonic()-idle > args.idle_timeout: break
            time.sleep(5)
        print(json.dumps(queue.summary(),ensure_ascii=False,indent=2))
        return 0 if all(queue.data['jobs'][e['slug']]['stages'].get(args.until,{}).get('status') == 'complete' for e in entries) else 1


if __name__ == '__main__':
    try:sys.exit(main())
    except KeyboardInterrupt:sys.exit(130)
    except Exception as error:
        print(str(error) if isinstance(error,(RuntimeError,ValueError)) else type(error).__name__,file=sys.stderr)
        sys.exit(1)
