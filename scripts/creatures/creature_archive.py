"""Deterministic source archives. Explicit files only; no credentials/session state."""
import gzip
import io
import json
from pathlib import Path
import subprocess
import tarfile
import urllib.parse

from model_build_queue import file_hash, native_directory
from trellis_checkpoint import write_json
from creature_archive_restore import restore_archive

ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = ['generate-trellis.py','trellis_checkpoint.py','trellis_transport.py','requirements.txt',
            'prepare-native-geometry.py','bake-native-miniature.py','miniature_scene.py',
            'optimize-miniature.mjs','render-final-miniature.py','lod_silhouette.py',
            'compare-lod-silhouette.py','lod-silhouette-policy.json','verify-single-miniature.mjs',
            'package-miniature.mjs','production-queue.py','production_stages.py','model_build_queue.py','creature_archive.py','creature_archive_restore.py','model-source-archive.py','miniature_mcp.py']


def archive_inputs(folder,stage):
    folder = Path(folder)
    recipe = json.loads((folder/'recipe.json').read_text())
    native = native_directory(folder,recipe.get('build',{}).get('nativeAttempt',1))
    inputs = {'recipe.json':folder/'recipe.json',
        'inputs/miniature-reference.png':folder/'miniature-reference.png',
        'inputs/handbook-reference.jpg':folder/'handbook-reference.jpg',
        'inputs/handbook-item.json':folder/'handbook-item.json',
        'inputs/reference-review.json':folder/'reference-review.json',
        'inputs/reference-prompt.txt':folder/'reference-prompt.txt',
        'native/generated-original.glb':native/'generated-original.glb',
        'native/generation.json':native/'generation.json'}
    for name in WORKFLOW:
        file = ROOT/'scripts/creatures'/name
        inputs['workflow/'+name] = file
    if stage=='ready':
        inputs['model-review.json']=folder/'model-review.json'
        files = ['model.glb','model-lod.glb','model-shadow.glb','model-source.glb']
        selected = {'geometry':[f'geometry-{r}.glb' for r in ['render','lod','shadow']]+['geometry-report.json'],
            'baked':files+['model.blend','placement.json']+[f'{r}-{c}.png' for r in ['render','lod'] for c in ['normal','basecolor','orm','coverage']],
            'final':files+['placement.json','model-stats.json','lod-silhouette.json','lod-silhouette.png','verification.json','catalogue.json','preview.webp']+
                [n+'.png' for n in ['preview','back','left','right','top','lod-preview','lod-top','grey-preview','grey-back','grey-top']]}
        for directory,names in selected.items():
            for name in names:inputs[directory+'/'+name] = folder/directory/name
    if any(not p.is_file() or p.is_symlink() for p in inputs.values()):
        raise ValueError('Archive is missing an explicit regular source file')
    return inputs


def pack_archive(folder,stage):
    folder = Path(folder)
    recipe = json.loads((folder/'recipe.json').read_text())
    inputs = archive_inputs(folder,stage)
    commit = subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
    dirty = subprocess.run(['git','diff','--quiet','--','scripts/creatures'],cwd=ROOT).returncode != 0
    manifest = {'schema':1,'itemId':recipe['itemId'],'modelId':recipe['modelId'],'stage':stage,
        'workflowCommit':commit,'workflowDirty':dirty,'files':[{'path':name,'size':p.stat().st_size,'sha256':file_hash(p)} for name,p in sorted(inputs.items())]}
    destination = folder/'archives';destination.mkdir(exist_ok=True)
    temporary = destination/(stage+'.tar.gz.part')
    with temporary.open('wb') as raw,gzip.GzipFile(filename='',mode='wb',fileobj=raw,mtime=0) as compressed,tarfile.open(fileobj=compressed,mode='w',format=tarfile.USTAR_FORMAT) as output:
        data = (json.dumps(manifest,ensure_ascii=False,sort_keys=True,indent=2)+'\n').encode()
        header = tarfile.TarInfo('archive-manifest.json');header.size=len(data)
        output.addfile(header,io.BytesIO(data))
        for name,file in sorted(inputs.items()):
            header = tarfile.TarInfo(name);header.size=file.stat().st_size;header.mode=0o644
            with file.open('rb') as source:output.addfile(header,source)
    sha = file_hash(temporary)
    target = destination/(sha+'.tar.gz');temporary.replace(target)
    descriptor = {'itemId':recipe['itemId'],'modelId':recipe['modelId'],'stage':stage,'sha256':sha,'size':target.stat().st_size}
    write_json(destination/(stage+'-archive.json'),dict(descriptor,fileName=target.name,manifest=manifest))
    return target,destination/(stage+'-archive.json')


def s3_url(url):
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != 'https' or not (parsed.hostname=='storage.yandexcloud.net' or (parsed.hostname or '').endswith('.storage.yandexcloud.net')):
        raise ValueError('Archive transfer must use project S3')
    return url


def publish_archive(folder,stage,mcp):
    folder = Path(folder)
    descriptor = json.loads((folder/'archives'/(stage+'-archive.json')).read_text())
    identity = {key:descriptor[key] for key in ['itemId','modelId','stage','sha256','size']}
    file = folder/'archives'/descriptor['fileName']
    if file_hash(file) != descriptor['sha256']:raise ValueError('Archive changed before upload')
    key = f"creature-model-archives/{identity['itemId']}/{identity['modelId']}/{stage}/{identity['sha256']}.tar.gz"
    cursor = ''
    while True:
        current = mcp.call('creature_model_archive_list',{'itemId':identity['itemId'],**({'cursor':cursor} if cursor else {})})
        if any(a['key']==key and a['size']==identity['size'] for a in current['archives']):
            verified = mcp.call('creature_model_archive_complete_upload',dict(identity,uploadKey='already-published'))
            break
        cursor = current.get('nextCursor')
        if not cursor:
            prepared = mcp.call('creature_model_archive_prepare_upload',identity)
            import http.client
            parsed=urllib.parse.urlsplit(s3_url(prepared['uploadUrl']))
            connection=http.client.HTTPSConnection(parsed.hostname,timeout=300)
            try:
                connection.putrequest('PUT',parsed.path+('?'+parsed.query if parsed.query else ''))
                for name,value in prepared['headers'].items():connection.putheader(name,value)
                connection.putheader('Content-Length',str(identity['size']));connection.endheaders()
                with file.open('rb') as source:
                    for chunk in iter(lambda:source.read(1024*1024),b''):connection.send(chunk)
                response=connection.getresponse();response.read()
                if response.status not in (200,201,204):raise RuntimeError('Archive S3 upload failed')
            finally:connection.close()
            verified=mcp.call('creature_model_archive_complete_upload',dict(identity,uploadKey=prepared['uploadKey']))
            break
    if verified['key']!=key or verified['sha256']!=identity['sha256'] or verified['size']!=identity['size']:
        raise ValueError('Archive registry readback differs')
    receipt = folder/'archives'/(stage+'-publication.json')
    write_json(receipt,dict(identity,key=key,verified=True))
    return receipt
