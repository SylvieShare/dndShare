#!/usr/bin/env python3
"""Generate or resume a TRELLIS.2 miniature; repeating the command reuses receipts."""
import argparse
import getpass
import json
from pathlib import Path
import sys

from trellis_checkpoint import Checkpoint, atomic_write, digest, output_lock, write_json
from trellis_transport import TrellisRemote, validate_glb


def metadata(checkpoint, exported):
    settings = checkpoint.data['identity']['settings']
    result = dict(provider='microsoft/TRELLIS.2', **settings, originalMeshExported=exported)
    if exported:
        path = checkpoint.file('glb')
        result.update(bytes=path.stat().st_size, sha256=digest(path.read_bytes()))
    else:
        result['viewsSaved'] = True
    write_json(checkpoint.folder/'generation.json', result)
    return result


def workflow(checkpoint, image, remote_factory, views_only=False):
    glb = checkpoint.file('glb')
    if glb:
        validate_glb(glb.read_bytes())
        return metadata(checkpoint, True)
    if views_only and checkpoint.file('preview'):
        return metadata(checkpoint, False)
    remote = remote_factory(checkpoint.data['sessionHash'])
    try:
        if hasattr(remote, 'contract'):
            contract = remote.contract()
            old = checkpoint.data.get('contract')
            if old and old != contract:
                raise RuntimeError('Provider API changed since this generation; checkpoint preserved')
            checkpoint.data['contract'] = contract
            checkpoint.save()
        checkpoint.step('start_session', remote, {})
        prepared = checkpoint.file('prepared')
        if prepared is None:
            output = checkpoint.step('preprocess_image', remote, lambda: {'input': remote.upload(image)})
            prepared = checkpoint.folder/'trellis-input.png'
            remote.download(output[0], prepared)
            checkpoint.remember('prepared', prepared)
        preview = checkpoint.file('preview')
        if preview is None:
            settings = checkpoint.data['identity']['settings']
            output = checkpoint.step('image_to_3d', remote, lambda: {
                'image': remote.upload(prepared), 'seed': settings['seed'], 'resolution': settings['resolution']})
            html = [value for value in output if isinstance(value, str)]
            if len(html) != 1:
                raise ValueError('Provider returned no unique generation preview')
            preview = checkpoint.folder/'generation-preview.html'
            atomic_write(preview, html[0].encode())
            checkpoint.remember('preview', preview)
        if views_only:
            return metadata(checkpoint, False)
        settings = checkpoint.data['identity']['settings']
        output = checkpoint.step('extract_glb', remote, {
            'decimation_target': settings['decimationTarget'], 'texture_size': settings['textureSize']})
        path = checkpoint.folder/'generated-original.glb'
        remote.download(output[0], path, glb=True)
        checkpoint.remember('glb', path)
        return metadata(checkpoint, True)
    finally:
        remote.close()


def authenticate(args):
    token = getpass.getpass('HF token (not saved): ') if args.token_stdin else False
    if token:
        from huggingface_hub import HfApi
        account = HfApi(token=token).whoami()
        if account.get('type') != 'user' or (account.get('isPro') and not args.allow_pro):
            raise RuntimeError('A personal account is required; PRO use needs --allow-pro authorization')
        print('Authenticated personal account; token stays in memory', flush=True)
    return token


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('image', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--resolution', choices=['512', '1024', '1536'], default='1024')
    parser.add_argument('--seed', type=int, default=1635)
    parser.add_argument('--token-stdin', action='store_true', help='Hidden terminal input, never persisted')
    parser.add_argument('--allow-pro', action='store_true', help='Use an already authorized personal PRO account')
    parser.add_argument('--views-only', action='store_true', help='Stop after preview; next run can resume extraction')
    parser.add_argument('--status', action='store_true', help='Show local progress without network or credentials')
    parser.add_argument('--wait-timeout', type=int, default=600, help='Seconds to wait for an existing event per run')
    args = parser.parse_args()
    if args.status:
        print(json.dumps(Checkpoint(args.output).status()))
        return
    if not 0 <= args.seed <= 2147483647 or args.wait_timeout <= 0:
        parser.error('Invalid seed or wait timeout')
    identity = {'provider': 'microsoft/TRELLIS.2', 'imageSHA256': digest(args.image.read_bytes()),
                'settings': {'seed': args.seed, 'resolution': args.resolution,
                             'decimationTarget': 300000, 'textureSize': 2048}}
    with output_lock(args.output):
        checkpoint = Checkpoint(args.output, identity)
        token = None

        def remote(session_hash):
            nonlocal token
            token = authenticate(args)
            return TrellisRemote(session_hash, token, args.wait_timeout)

        result = workflow(checkpoint, args.image, remote, args.views_only)
        print(json.dumps(result), flush=True)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('Interrupted; rerun the same command to resume its checkpoint', file=sys.stderr)
        sys.exit(130)
    except Exception as error:
        # Transport errors can include private event/file URLs; keep them local.
        message = str(error) if isinstance(error, (RuntimeError, ValueError)) else 'Provider/network error; rerun the same output folder to resume'
        print(message, file=sys.stderr)
        sys.exit(1)
