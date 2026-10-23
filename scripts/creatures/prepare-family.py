#!/usr/bin/env python3
"""Prepare a review gallery and one content-addressed MCP upload bundle."""
import argparse
import json
import os
import shutil
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('directory',type=Path)
args=parser.parse_args()
out=args.directory.resolve();root=Path(__file__).resolve().parents[2]
recipes=json.loads(Path(__file__).with_name('kobold-family.json').read_text())
combined=out/'publish';combined.mkdir(exist_ok=True)
models=[]
for recipe in recipes:
    folder=out/recipe['slug']
    stats=json.loads((folder/'model-stats.json').read_text())
    recipe['maxHeight']=round(next(s for s in stats if s['role']=='render')['bounds'][1][1]+.002,4)
    (folder/'recipe.json').write_text(json.dumps(recipe,ensure_ascii=False,indent=2)+'\n')
    subprocess.run(['node',str(root/'scripts/creatures/package-miniature.mjs'),str(folder),str(folder/'recipe.json')],check=True,capture_output=True)
    model=json.loads((folder/'publish/catalogue.json').read_text())[0];models.append(model)
    for asset in model['assets'].values():
        name=Path(asset['key']).name;source=folder/'publish'/name;target=combined/name
        if not target.exists():
            os.link(source,target)
(combined/'catalogue.json').write_text(json.dumps(models,ensure_ascii=False,indent=2)+'\n')

base=out.parent/'kobold-1635-v2';existing=out/'kobold';existing.mkdir(exist_ok=True)
for source,target in [('kobold-1635.glb','model.glb'),('kobold-1635-lod.glb','model-lod.glb'),
    ('kobold-1635-master.glb','model-source.glb'),('preview.png','preview.png')]:
    shutil.copy2(base/source,existing/target)
gallery=[{'slug':'kobold','name':'Кобольд','itemIds':[1635],'existing':True}]+recipes
(out/'gallery.json').write_text(json.dumps(gallery,ensure_ascii=False,indent=2)+'\n')
shutil.copytree(base/'viewer',out/'viewer',dirs_exist_ok=True)
shutil.copy2(Path(__file__).with_name('family-viewer.html'),out/'preview.html')
shutil.copy2(Path(__file__).with_name('family-viewer.js'),out/'family-viewer.js')

font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',18)
sheet=Image.new('RGB',(1600,1320),(31,35,39));draw=ImageDraw.Draw(sheet)
for i,recipe in enumerate(gallery):
    im=Image.open(out/recipe['slug']/'preview.png').convert('RGBA');im.thumbnail((390,390))
    x=(i%4)*400;y=(i//4)*440
    sheet.paste(im,(x+(400-im.width)//2,y+38),im)
    draw.text((x+8,y+6),recipe['name'],font=font,fill=(237,223,203))
    draw.text((x+8,y+417),'ID '+', '.join(map(str,recipe['itemIds'])),font=font,fill=(175,183,188))
sheet.save(out/'miniatures.jpg',quality=93)
print(json.dumps({'newModels':len(models),'galleryModels':len(gallery),
    'itemIds':[i for r in gallery for i in r['itemIds']],
    'uploadBytes':sum(a['size'] for m in models for a in m['assets'].values())}))
