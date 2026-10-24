"""Local CPU stages, review gate, archives and publication for BuildQueue."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

from creature_archive import archive_inputs, pack_archive, publish_archive
from miniature_mcp import MiniatureMCP, configured_token
from model_build_queue import file_hash, native_directory
from trellis_checkpoint import write_json

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT/'scripts/creatures'
BLENDER = '/Applications/Blender.app/Contents/MacOS/Blender'
ROLES = ['render','lod','shadow']
FILES = ['model.glb','model-lod.glb','model-shadow.glb','model-source.glb']


def execute(command,log,env=None):
    log.parent.mkdir(parents=True,exist_ok=True)
    with log.open('w') as output:
        subprocess.run([str(v) for v in command],cwd=ROOT,stdout=output,stderr=subprocess.STDOUT,check=True,env=env)


def scripts_hash(*names):
    return {name:file_hash(SCRIPTS/name) for name in names}


def build_settings(entry):
    return {key:entry[key] for key in ['height','footprint','size','lodTriangles','dropComponentsBelow','fillSmallHoles','lodAggression','shadowTriangles','shadowAggression','nativeAttempt','seed','surfaceClosure'] if key in entry} | {'rotation':-45}


def prepare_recipe(entry,folder):
    path=folder/'recipe.json'
    recipe=json.loads(path.read_text())
    recipe['build']=build_settings(entry)
    if path.read_text()!=json.dumps(recipe,ensure_ascii=False,indent=2)+'\n':
        path.write_text(json.dumps(recipe,ensure_ascii=False,indent=2)+'\n')
    return path


def geometry_inputs(entry,folder):
    inputs = {'native':file_hash(native_directory(folder,entry.get('nativeAttempt',1))/'generated-original.glb'),
            'lodTriangles':entry['lodTriangles'],'dropComponentsBelow':entry.get('dropComponentsBelow',0),
            'fillSmallHoles':entry.get('fillSmallHoles',False),'lodAggression':entry.get('lodAggression',3),
            'shadowTriangles':entry.get('shadowTriangles',3500),'shadowAggression':entry.get('shadowAggression',7),
            'scripts':scripts_hash('prepare-native-geometry.py')}
    if entry.get('surfaceClosure'):
        inputs['surfaceClosure'] = entry['surfaceClosure']
        inputs['scripts'].update(scripts_hash('close-native-surface.py'))
    return inputs


def bake_inputs(entry,folder):
    recipe=json.loads((folder/'recipe.json').read_text())
    return {'native':file_hash(native_directory(folder,entry.get('nativeAttempt',1))/'generated-original.glb'),
        'geometry':{r:file_hash(folder/'geometry'/f'geometry-{r}.glb') for r in ROLES},
        'build':build_settings(entry),'calibration':recipe.get('calibration'),
        'materialProfile':recipe.get('materialProfile'),'referenceDiameter':recipe['referenceDiameter'],
        'scripts':scripts_hash('bake-native-miniature.py','miniature_scene.py')}


def process(queue,entry,until,server_token):
    folder=queue.root/entry['slug'];logs=folder/'logs';changed=False
    recipe=prepare_recipe(entry,folder)
    raw=native_directory(folder,entry.get('nativeAttempt',1))/'generated-original.glb'
    geometry=folder/'geometry';baked=folder/'baked';final=folder/'final'

    def stage(name,inputs,action):
        nonlocal changed
        changed |= queue.stage(entry,name,inputs,action)

    def archive(stage_name):
        inputs={name:file_hash(path) for name,path in archive_inputs(folder,stage_name).items()}
        stage('archive-'+stage_name,inputs,lambda:pack_archive(folder,stage_name))
        if server_token:
            if not hasattr(queue,'mcp'):queue.mcp=MiniatureMCP(configured_token(True))
            stage('archive-'+stage_name+'-published',{'descriptor':file_hash(folder/'archives'/(stage_name+'-archive.json'))},
                  lambda:[publish_archive(folder,stage_name,queue.mcp)])
    archive('native')

    def geometry_stage():
        source=raw;extra=[]
        if entry.get('surfaceClosure'):
            source=geometry/'closed-source.glb';settings=entry['surfaceClosure']
            execute([sys.executable,SCRIPTS/'close-native-surface.py',raw,source,'--pitch',settings['pitch'],'--radius',settings['radius']],logs/'closure.log')
            extra=[source,source.with_suffix('.json')]
        command=[sys.executable,SCRIPTS/'prepare-native-geometry.py',geometry,'--source',source,'--lod-triangles',entry['lodTriangles']]
        if entry.get('dropComponentsBelow'):command+=['--drop-components-below',entry['dropComponentsBelow']]
        if entry.get('fillSmallHoles'):command+=['--fill-small-holes']
        for key,flag in [('lodAggression','--lod-aggression'),('shadowTriangles','--shadow-triangles'),('shadowAggression','--shadow-aggression')]:
            if key in entry:command+=[flag,entry[key]]
        execute(command,logs/'geometry.log')
        return [geometry/f'geometry-{r}.glb' for r in ROLES]+[geometry/'geometry-report.json']+extra
    stage('geometry',geometry_inputs(entry,folder),geometry_stage)

    def bake_stage():
        command=[BLENDER,'--background','--factory-startup','--python-exit-code','1','--python',SCRIPTS/'bake-native-miniature.py','--',baked,
                 '--source',raw,'--geometry-dir',geometry,'--recipe',recipe,'--token-size',entry['size'],'--rotation','-45','--skip-preview']
        command += ['--footprint',entry['footprint']] if 'footprint' in entry else ['--height',entry['height']]
        execute(command,logs/'bake.log')
        return [baked/f for f in FILES+['placement.json','model.blend']]
    stage('bake',bake_inputs(entry,folder),bake_stage)

    def optimize():
        final.mkdir(exist_ok=True)
        for name in FILES+['placement.json']:shutil.copy2(baked/name,final/name)
        execute(['node',SCRIPTS/'optimize-miniature.mjs',final,recipe],logs/'optimize.log')
        return [final/f for f in FILES+['model-stats.json','placement.json']]
    stage('optimize',{'baked':{f:file_hash(baked/f) for f in FILES},'placement':file_hash(baked/'placement.json'),
        'profile':json.loads(recipe.read_text())['materialProfile'],'scripts':scripts_hash('optimize-miniature.mjs')},optimize)

    def render():
        execute([BLENDER,'--background','--factory-startup','--python-exit-code','1','--python',SCRIPTS/'render-final-miniature.py','--',final,'--recipe',recipe,'--grey'],logs/'render.log')
        return [final/(name+'.png') for name in ['preview','back','left','right','top','lod-preview','lod-top','grey-preview','grey-back','grey-top']]
    stage('render',{'render':file_hash(final/'model.glb'),'lod':file_hash(final/'model-lod.glb'),
        'scripts':scripts_hash('render-final-miniature.py','miniature_scene.py')},render)

    def compare():
        execute([sys.executable,SCRIPTS/'compare-lod-silhouette.py',final,'--recipe',recipe],logs/'silhouette.log')
        return [final/'lod-silhouette.json',final/'lod-silhouette.png']
    stage('silhouette',{'render':file_hash(final/'model.glb'),'lod':file_hash(final/'model-lod.glb'),
        'policy':json.loads(recipe.read_text()).get('lodSilhouette'),'scripts':scripts_hash('lod_silhouette.py','compare-lod-silhouette.py','lod-silhouette-policy.json')},compare)

    def verify():
        execute(['node',SCRIPTS/'verify-single-miniature.mjs',final,recipe],logs/'verify.log')
        return [final/'verification.json']
    stage('verify',{'assets':{f:file_hash(final/f) for f in FILES},'stats':file_hash(final/'model-stats.json'),
        'placement':file_hash(final/'placement.json'),'silhouette':file_hash(final/'lod-silhouette.json'),
        'recipe':file_hash(recipe),'scripts':scripts_hash('verify-single-miniature.mjs')},verify)

    review_file=folder/'model-review.json'
    if not review_file.exists():
        queue.data['jobs'][entry['slug']]['status']='awaiting-model-review';queue.save()
        return changed
    review=json.loads(review_file.read_text())
    if not review.get('approved') or review.get('renderSHA256')!=file_hash(final/'model.glb') or review.get('lodSHA256')!=file_hash(final/'model-lod.glb'):
        raise ValueError('Model review is missing or stale: '+entry['slug'])

    def ready():
        execute(['node',SCRIPTS/'package-miniature.mjs',final,recipe],logs/'package.log')
        catalog=json.loads((final/'publish/catalogue.json').read_text())[0]
        shutil.copy2(final/'publish'/Path(catalog['assets']['preview']['key']).name,final/'preview.webp')
        shutil.copy2(final/'publish/catalogue.json',final/'catalogue.json')
        path=folder/'ready.json';write_json(path,{'verified':True,'review':review,'catalogue':catalog})
        return [path,final/'catalogue.json',final/'preview.webp',final/'publish/catalogue.json']
    stage('ready',{'review':file_hash(review_file),'verification':file_hash(final/'verification.json'),
        'recipe':file_hash(recipe),'preview':file_hash(final/'preview.png'),'script':scripts_hash('package-miniature.mjs')},ready)
    archive('ready')
    if until=='published':
        if not server_token:raise ValueError('Publishing requires the authorized project MCP credential')
        def publish():
            command=[sys.executable,SCRIPTS/'publish-miniature.py',final,recipe,'--publish']
            receipt=final/'publication.json'
            if receipt.exists():command+=['--update-from',receipt]
            execute(command,logs/'publish.log',env=dict(os.environ,MCP_AUTH_TOKEN=queue.mcp.token,GOCACHE='/private/tmp/dndshare-go-cache'))
            return [receipt]
        stage('published',{'catalogue':file_hash(final/'catalogue.json'),'archive':file_hash(folder/'archives/ready-publication.json')},publish)
    return changed
