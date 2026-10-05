"""Door and raised hardware bounds, shared with detailed UV painting."""
import json
from pathlib import Path
import numpy as np
SPEC=json.loads(Path(__file__).with_name('ud010-material.json').read_text())


def door_parts(x,y,z):
    portal,hardware=SPEC['portal'],SPEC['hardware']
    inside=(x>=portal['minX'])&(x<=portal['maxX'])&(z>=portal['bottom'])&(np.hypot(y,np.maximum(0,z-portal['spring']))<=portal['radius'])
    result=np.where(inside,1,0).astype(np.uint8)
    raised=(x<=hardware['front'])|(x>=hardware['back'])
    ring=SPEC['ring']; shaped=((y-ring['center'][0])/ring['radius'][0])**2+((z-ring['center'][1])/ring['radius'][1])**2<1
    for strap in SPEC['straps']:
        ay,az=strap['a'];by,bz=strap['b'];dy,dz=by-ay,bz-az
        t=np.clip(((y-ay)*dy+(z-az)*dz)/(dy*dy+dz*dz),0,1)
        shaped|=np.hypot(y-ay-t*dy,z-az-t*dz)<strap['radius']
    raised|=shaped&((x<=hardware['bevelFront'])|(x>=hardware['bevelBack']))
    result[inside&raised]=2
    return result
