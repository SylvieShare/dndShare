"""Hash-bound placement evidence and art review; no Blender dependency."""
import json
from pathlib import Path

from model_build_queue import file_hash, fingerprint

ROOT = Path(__file__).resolve().parents[2]
BODY_FILES = ['model.glb','model-lod.glb','model-shadow.glb','model-source.glb']
REVIEW_IMAGES = ['preview','back','left','right','top','grey-preview','grey-back','grey-top','lod-preview','lod-top']
PLACEMENT_IMAGES = ['on-base.png','on-base-top.png']


def review_base(recipe):
    base = recipe.get('reviewBase') or {}
    if not base.get('modelId') or not base.get('file') or not base.get('referenceDiameter',0)>0 or not base.get('surfaceHeight',0)>=0:
        raise ValueError('A measured reviewBase is required before placement review')
    file = Path(base['file'])
    file = file if file.is_absolute() else ROOT/file
    if not file.is_file(): raise ValueError('Review base file is missing')
    return file, {k:base[k] for k in ['modelId','referenceDiameter','surfaceHeight']}


def placement_context(folder,recipe,size,base_file=None,base_diameter=None,surface_height=None):
    folder = Path(folder)
    file,base = review_base(recipe)
    if base_file is not None:
        if Path(base_file).resolve()!=file.resolve() or base_diameter!=base['referenceDiameter'] or surface_height!=base['surfaceHeight']:
            raise ValueError('Rendered base differs from the reviewed recipe')
    if not size>0: raise ValueError('Positive nominal size required')
    return {'schema':1,'modelId':recipe['modelId'],'itemId':recipe['itemId'],
        'bodySHA256':file_hash(folder/'model.glb'),'lodSHA256':file_hash(folder/'model-lod.glb'),
        'size':size,'referenceDiameter':recipe['referenceDiameter'],'calibration':recipe.get('calibration'),
        'materialProfile':recipe.get('materialProfile','native'),'texturePolicy':recipe.get('texturePolicy'),
        'texturePolicySHA256':file_hash(Path(__file__).with_name('texture-policy.json')),
        'artProfile':recipe.get('artProfile'),'supportKind':recipe.get('supportKind'),
        'base':dict(base,sha256=file_hash(file)),
        'bodyFormula':'0.7*size/referenceDiameter','baseFormula':'size-min(0.3,0.3*size)'}


def write_placement_evidence(folder,context):
    folder = Path(folder)
    evidence={'schema':1,'context':context,'images':{n:file_hash(folder/n) for n in PLACEMENT_IMAGES}}
    path=folder/'placement-review.json'
    path.write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+'\n')
    return path


def review_context(folder,recipe,size):
    folder = Path(folder)
    if recipe.get('artProfile') not in {'painted','physical'} or recipe.get('supportKind') not in {'grounded','flight','amorphous'}:
        raise ValueError('Explicit artProfile and supportKind required for review')
    evidence=json.loads((folder/'placement-review.json').read_text())
    expected=placement_context(folder,recipe,size)
    if evidence.get('schema')!=1 or evidence.get('context')!=expected:
        raise ValueError('Placement preview is stale; render the current size, calibration and base')
    if evidence.get('images')!={n:file_hash(folder/n) for n in PLACEMENT_IMAGES}:
        raise ValueError('Placement images changed after rendering')
    return {'schema':2,'placement':expected,
        'placementEvidenceSHA256':file_hash(folder/'placement-review.json'),
        'assets':{n:file_hash(folder/n) for n in BODY_FILES},
        'views':{n+'.png':file_hash(folder/(n+'.png')) for n in REVIEW_IMAGES}}


def require_review(folder,recipe,size,review_path):
    context=review_context(folder,recipe,size)
    review=json.loads(Path(review_path).read_text())
    if review.get('schema')!=2 or review.get('approved') is not True or review.get('contextSHA256')!=fingerprint(context) or review.get('context')!=context or not review.get('notes'):
        raise ValueError('Art review is missing or stale for the current assets, scale and placement')
    return review
