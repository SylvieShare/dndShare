"""Small byte fixtures for tests of review freshness, not geometry quality."""
import json
from pathlib import Path
from miniature_review import BODY_FILES, REVIEW_IMAGES, PLACEMENT_IMAGES, placement_context, write_placement_evidence, review_context
from model_build_queue import fingerprint


def reviewed_fixture(folder,recipe):
    folder=Path(folder)
    recipe.setdefault('build',{'size':1})
    recipe.setdefault('artProfile','painted');recipe.setdefault('supportKind','grounded')
    base=folder/'base.glb';base.write_bytes(b'base')
    recipe['reviewBase']={'file':str(base),'modelId':'base','referenceDiameter':.9,'surfaceHeight':.06}
    for name in BODY_FILES+ [n+'.png' for n in REVIEW_IMAGES]+PLACEMENT_IMAGES:
        if not (folder/name).exists():(folder/name).write_bytes(('fixture '+name).encode())
    write_placement_evidence(folder,placement_context(folder,recipe,recipe['build']['size']))
    context=review_context(folder,recipe,recipe['build']['size'])
    review={'schema':2,'approved':True,'context':context,'contextSHA256':fingerprint(context),'notes':['Inspected fixture']}
    (folder/'model-review.json').write_text(json.dumps(review))
    return recipe
