#!/usr/bin/env python3
"""Build a reviewable manifest from local PDF extracts and a catalogue snapshot.

No network or database writes. Publication is a separate preview/apply MCP call.
"""
import argparse,json
from pathlib import Path
from collections import Counter
from content_common import Catalogue
from aliases import SPELLS
import prepare_spells,prepare_equipment,prepare_classes,prepare_origins,prepare_options

def build(directory):
    read=lambda name:json.loads((directory/name).read_text())
    pages,raw=read('blocks2024.json'),read('2024.json')
    cat=Catalogue(read('all.json'));metadata=read('metadata.json')
    prepare_spells.prepare(pages,cat,SPELLS)
    gear,sets=prepare_equipment.prepare(pages,raw,cat,metadata)
    prepare_classes.prepare(pages,raw,cat,gear,sets)
    prepare_origins.feats(pages,cat,sets)
    prepare_origins.backgrounds(raw,cat,gear,sets,metadata)
    prepare_origins.species(pages,cat)
    prepare_options.invocations(pages,cat)
    prepare_options.metamagic(pages,cat)
    prepare_options.maneuvers(pages,cat)
    prepare_options.conditions(pages,cat)
    keys={r['key']for r in cat.records};external={'suggest:4:martial-light','suggest:4:martial-finesse','suggest:6:common-sign'}
    def validate(value):
        if isinstance(value,dict):
            if '$ref'in value and value['$ref']not in keys|external:raise ValueError('Unresolved '+value['$ref'])
            for v in value.values():validate(v)
        elif isinstance(value,list):
            for v in value:validate(v)
    validate(cat.records)
    return {'records':cat.records,'decisions':cat.decisions,'reprints':[r['id']for r in cat.decisions if r['status']=='compatible']}
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('directory',type=Path);parser.add_argument('output',type=Path);args=parser.parse_args()
    result=build(args.directory);args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(Counter(r['typeId']for r in result['records']));print('records',len(result['records']),'shared',len(result['reprints']))
