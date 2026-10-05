"""Unpack provided multipart collections, retaining every print variant locally."""
from pathlib import Path
import json, subprocess, zipfile

ROOT = Path(__file__).resolve().parents[2]
MODELS = ROOT / 'models'
SEVEN = Path('/private/tmp/dndshare-7zip/7zz')
collections = [
 ('ultimate-dungeon', 'The Ultimate Dungeon', 'Dungeon Blocks - THE ULTIMATE DUNGEON (full)(sup)(stl).part1.rar'),
 ('toxic-sewer', 'The Toxic Sewer', 'Dungeon Blocks - The Toxic sewer (full)(sup)(stl).part1.rar'),
 ('lost-cave', 'The Lost Cave', 'Dungeon Blocks - The Lost Cave (full)(sup)(stl).part1.rar'),
]
report=[]
for key, name, archive in collections:
    base=MODELS/'collections'/key
    packages=base/'packages'; packages.mkdir(parents=True,exist_ok=True)
    marker=packages/'.complete'
    if not marker.exists():
        subprocess.run([str(SEVEN),'x','-y','-bd','-bb0',f'-o{packages}',str(MODELS/archive)],check=True)
        marker.write_text('ok\n')
    rows=[]
    for package in sorted(packages.rglob('*.zip')):
        dest=base/'variants'/package.stem
        done=dest/'.complete'
        with zipfile.ZipFile(package) as z:
            files=[i for i in z.infolist() if not i.is_dir()]
            for i in files:
                if not (dest/i.filename).resolve().is_relative_to(dest.resolve()):
                    raise ValueError('Unsafe archive path')
            if not done.exists():
                dest.mkdir(parents=True,exist_ok=True)
                z.extractall(dest)
                done.write_text('ok\n')
            rows.append({'archive':package.name,'files':len(files),'bytes':sum(i.file_size for i in files),
                         'directory':str(dest.relative_to(MODELS))})
        print('EXTRACTED',key,package.name,len(files),flush=True)
    report.append({'collection':key,'name':name,'packages':rows})
    (MODELS/'collections'/'extraction.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('COMPLETE',len(report),'collections',flush=True)
