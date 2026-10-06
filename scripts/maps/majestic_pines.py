"""Measured trunks and roots, dark olive foliage, and natural variation."""
import numpy as np


def apply_pines(obj, positions, colours, roughness, coverage, recipe):
    normals=np.empty(len(obj.data.vertices)*3,np.float32)
    obj.data.vertices.foreach_get('normal',normals); normals=normals.reshape(-1,3)
    x,y,z=positions.T
    for tree in recipe['trees']:
        t=np.clip((z-15)/(tree['heightMM']-15),0,1)
        base,top=np.array(tree['baseXY']),np.array(tree['topXY'])
        centres=base[None,:]+t[:,None]*(top-base)
        delta=positions[:,:2]-centres
        radial=np.linalg.norm(delta,axis=1)
        domain=radial<tree['foliageRadiusMM']
        foliage=domain & (z>19)
        variation=1+.055*np.sin(x*.19+y*.17+z*.11)+.035*np.sin(x*.41-y*.23+z*.37)
        tips=np.clip(normals[:,2],0,1)*.3+t*.15
        dark=np.array([.19,.29,.075]); light=np.array([.33,.43,.13])
        leaves=((1-tips[:,None])*dark+tips[:,None]*light)*variation[:,None]
        colours[foliage]=leaves[foliage];roughness[foliage]=.89
        trunk=domain & (radial<tree['trunkRadiusMM']) & (z>15.2) & (z<tree['barkTopMM']) & (np.abs(normals[:,2])<.75)
        roots=domain & (radial<tree['rootRadiusMM']) & (z>15.2) & (z<19.6) & ((coverage<.75) | (not recipe.get('grassReference')))
        wood=trunk|roots
        angle=np.arctan2(delta[:,1],delta[:,0])
        grain=.95+.07*np.sin(angle*19+z*.08)+.025*np.sin(z*.31)
        bark=np.array([.32,.205,.115])*grain[:,None]
        colours[wood]=bark[wood];roughness[wood]=.94
    if recipe.get('stoneRing'):
        ring=recipe['stoneRing']; radial=np.linalg.norm(positions[:,:2]-np.array(ring['centreXY']),axis=1)
        weight=np.clip((radial-ring['innerRadiusMM'])/1.2,0,1)*np.clip((ring['outerRadiusMM']-radial)/1.2,0,1)
        weight*=np.clip((z-ring['minZMM'])/.7,0,1)*np.clip((ring['maxZMM']-z)/1.5,0,1)
        material=np.array([.40,.36,.28])*(1+.045*np.sin(x*.53+y*.67+z*.19))[:,None]
        colours=colours*(1-weight[:,None])+material*weight[:,None]
        roughness=roughness*(1-weight)+.92*weight
    bark_cores=np.zeros(len(positions),bool)
    for tree in recipe['trees']:
        t=np.clip((z-15)/(tree['heightMM']-15),0,1)
        base,top=np.array(tree['baseXY']),np.array(tree['topXY'])
        centre=base[None,:]+t[:,None]*(top-base)
        bark_cores|=(np.linalg.norm(positions[:,:2]-centre,axis=1)<tree['trunkRadiusMM']) & (z>15.2) & (z<tree['barkTopMM'])
    for fern in recipe.get('ferns',[]):
        centre=np.array(fern['centreMM']); radii=np.array(fern['radiiMM'])
        distance=((positions-centre)/radii)**2
        weight=np.clip((1.1-distance.sum(1))/.25,0,1)*np.clip((z-fern['minZMM'])/.45,0,1)*(~bark_cores)
        vein=.94+.055*np.sin(x*.9+y*.6)+.025*np.sin(x*1.7-y*.8)
        material=np.array([.31,.43,.12])*vein[:,None]
        colours=colours*(1-weight[:,None])+material*weight[:,None]
        roughness=roughness*(1-weight)+.88*weight
    for stone in recipe.get('stones',[]):
        centre=np.array(stone['centreMM']); radii=np.array(stone['radiiMM'])
        distance=((positions-centre)/radii)**2
        weight=np.clip((1.15-distance.sum(1))/.25,0,1)
        material=np.array([.41,.365,.28])*(1+.04*np.sin(x*.71+y*.53+z*.37))[:,None]
        colours=colours*(1-weight[:,None])+material*weight[:,None]
        roughness=roughness*(1-weight)+.92*weight
    return colours,roughness
