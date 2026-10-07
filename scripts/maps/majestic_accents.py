"""Measured rounded low props with distinct tops and supporting parts."""
import numpy as np


def apply_accents(positions,colours,roughness,recipe):
    x,y,z=positions.T
    for prop in recipe.get('roundedAccents',[]):
        centre=np.array(prop['xyMM']);radial=np.linalg.norm(positions[:,:2]-centre,axis=1)
        weight=np.clip((prop['radiusMM']-radial)/.8,0,1)*np.clip((z-prop['minZMM'])/.5,0,1)
        weight*=np.clip((prop['maxZMM']-z)/.7,0,1)
        cap=np.clip((z-prop['capStartMM'])/.7,0,1);cap=cap*cap*(3-2*cap)
        variation=1+.04*np.sin(x*.61+y*.43+z*.27)
        body=np.array(prop['stemRGB']);top=np.array(prop['capRGB'])
        material=((1-cap[:,None])*body+cap[:,None]*top)*variation[:,None]
        colours=colours*(1-weight[:,None])+material*weight[:,None]
        roughness=roughness*(1-weight)+(.94-.04*cap)*weight
    return colours,roughness
