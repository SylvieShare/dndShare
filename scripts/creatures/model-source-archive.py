#!/usr/bin/env python3
"""Pack, publish or restore a creature's explicit source archive."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
import urllib.request

from creature_archive import pack_archive, publish_archive, restore_archive, s3_url
from miniature_mcp import MiniatureMCP, configured_token


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory',type=Path,nargs='?')
    parser.add_argument('--stage',choices=['native','ready'],default='native')
    parser.add_argument('--publish',action='store_true')
    parser.add_argument('--server-token',action='store_true')
    parser.add_argument('--restore',type=Path,help='Local tar.gz, validated before extraction')
    parser.add_argument('--restore-receipt',type=Path,help='Verified S3 receipt; download and validate before extraction')
    parser.add_argument('--destination',type=Path)
    args=parser.parse_args()
    if args.restore or args.restore_receipt:
        if args.destination is None:parser.error('restore requires --destination')
        archive=args.restore
        if args.restore_receipt:
            descriptor=json.loads(args.restore_receipt.read_text())
            identity={k:descriptor[k] for k in ['itemId','modelId','stage','sha256','size']}
            mcp=MiniatureMCP(configured_token(args.server_token))
            remote=mcp.call('creature_model_archive_get',identity)
            archive=args.destination.with_suffix('.download.tar.gz')
            archive.parent.mkdir(parents=True,exist_ok=True)
            temporary=archive.with_suffix('.part')
            size=0;hashed=hashlib.sha256()
            with urllib.request.urlopen(s3_url(remote['downloadUrl']),timeout=300) as response,temporary.open('wb') as output:
                for chunk in iter(lambda:response.read(1024*1024),b''):
                    size+=len(chunk)
                    if size>identity['size']:raise ValueError('Downloaded archive exceeds expected bytes')
                    hashed.update(chunk);output.write(chunk)
            if size!=identity['size'] or hashed.hexdigest()!=identity['sha256']:raise ValueError('Downloaded archive checksum differs')
            temporary.replace(archive)
        result=restore_archive(archive,args.destination)
        print(json.dumps({'restored':True,'itemId':result['itemId'],'modelId':result['modelId'],'files':len(result['files'])}))
        return
    if args.directory is None:parser.error('source directory required')
    file,descriptor=pack_archive(args.directory,args.stage)
    if args.publish:
        receipt=publish_archive(args.directory,args.stage,MiniatureMCP(configured_token(args.server_token)))
        print(json.dumps({'verified':True,'receipt':str(receipt)}))
    else:
        print(json.dumps({'dryRun':True,'file':str(file),'descriptor':str(descriptor),'bytes':file.stat().st_size}))


if __name__=='__main__':
    try:main()
    except Exception as error:
        print(str(error) if isinstance(error,(RuntimeError,ValueError)) else type(error).__name__,file=sys.stderr)
        sys.exit(1)
