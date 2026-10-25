import { awayFromSource } from './medieval_source_reference.mjs';

export function structureDomain(p, part) {
  let q = p;
  if (part.rotationZDeg!==undefined) {
    const a = part.rotationZDeg*Math.PI/180, d = p.map((v,i) => v-part.centerMM[i]);
    q = [d[0]*Math.cos(a)+d[1]*Math.sin(a),-d[0]*Math.sin(a)+d[1]*Math.cos(a),d[2]];
  }
  if (q.some((v,i) => v<part.minMM[i] || v>part.maxMM[i])) return false;
  if (part.ellipsoid && q.reduce((sum,v,i) => sum+((v-part.ellipsoid.centerMM[i])/part.ellipsoid.radiiMM[i])**2,0)>1) return false;
  if (part.drapedOverCrate) {
    const s = part.drapedOverCrate;
    if (!(p[2]>=s.topStartMM || (p[2]>=s.edgeStartMM && Math.abs(q[0])<s.edgeHalfXMM && Math.abs(q[1])>s.edgeMinYMM))) return false;
  }
  if (part.absYMM && (Math.abs(p[1])<part.absYMM[0] || Math.abs(p[1])>part.absYMM[1])) return false;
  if (part.projection) {
    const s = part.projection, t = p.reduce((sum,v,i) => sum+(v-s.originMM[i])*s.axis[i], 0);
    if (t<s.rangeMM[0] || t>s.rangeMM[1]) return false;
  }
  if (part.radialShell) {
    const shell = part.radialShell, delta = p.map((v,i) => v-shell.originMM[i]);
    const t = delta.reduce((sum,v,i) => sum+v*shell.axis[i],0);
    const radius = Math.hypot(...delta.map((v,i) => v-t*shell.axis[i]));
    const outer = shell.radiusAtOriginMM+shell.radiusSlope*t;
    if (t<shell.rangeMM[0] || t>shell.rangeMM[1] || radius<outer-shell.thicknessMM || radius>outer+shell.allowanceMM) return false;
  }
  if (part.includeParts?.length && !part.includeParts.some(child => structureDomain(p,child))) return false;
  if ((part.excludeParts || []).some(excluded => structureDomain(p,excluded))) return false;
  if (part.awayFromSource && !awayFromSource(p,part.awayFromSource)) return false;
  if (part.nearSource && awayFromSource(p,part.nearSource)) return false;
  return true;
}

export function terrainRoughness(p, settings) {
  let stone = Math.max(0, Math.min(1,(p[2]-settings.stoneStartMM)/settings.stoneBlendMM));
  stone = stone*stone*(3-2*stone);
  if (settings.stoneBordersMM) {
    const [lo,hi] = settings.stoneBordersMM;
    const edge = Math.max(0,Math.min(1,(Math.max(Math.abs(p[0]),Math.abs(p[1]))-lo)/(hi-lo)));
    stone *= edge*edge*(3-2*edge);
  }
  return .96-.06*stone;
}

export function structureMetal(p, settings) {
  let metallic = 0, roughness = terrainRoughness(p, settings);
  for (const part of settings.woodParts || []) if (structureDomain(p, part)) {
    roughness = part.roughness ?? .88;
    if (['log-x','log-y'].includes(part.axis)) {
      const along = part.axis==='log-x' ? 0 : 1;
      if (part.endRangesMM.some(([lo,hi]) => p[along]>=lo && p[along]<=hi)) roughness = part.endRoughness;
    }
  }
  for (const part of settings.stoneParts || []) if (structureDomain(p, part)) roughness = .91;
  for (const part of settings.fabricParts || []) if (structureDomain(p, part)) roughness = .98;
  for (const part of settings.produceParts || []) if (structureDomain(p, part)) roughness = part.roughness;
  for (const part of settings.surfaceParts || []) if (structureDomain(p, part)) {
    roughness = part.roughness; metallic = part.metallic || 0;
  }
  for (const part of settings.ironParts || []) if (structureDomain(p, part)) {
    metallic = part.metallic; roughness = part.roughness;
  }
  for (const h of settings.hardware || []) {
    if (p[2]<h.minZMM || (h.maxZMM!==undefined && p[2]>h.maxZMM)) continue;
    const d = p.reduce((sum,v,c) => sum+((v-h.centerMM[c])/h.radiiMM[c])**2, 0);
    const w = Math.max(0, Math.min(1, (1-d)/.2));
    metallic = Math.max(metallic, w*.9); roughness = roughness*(1-w)+.55*w;
  }
  return { metallic, roughness };
}

export function structureLiquid(p, settings) {
  const part = (settings.surfaceParts || []).findLast(part => structureDomain(p, part));
  return part?.kind==='liquid' ? part : null;
}

export function structureFlame(p, settings) {
  const part = (settings.surfaceParts || []).findLast(part => structureDomain(p, part));
  if (part?.kind!=='flame') return null;
  if (part.gradientZMM===undefined || part.gradientZMM===null) return part;
  if (!Array.isArray(part.gradientZMM) || part.gradientZMM.length!==2) {
    throw new Error('Flame gradient requires increasing heights and two RGB colours');
  }
  const [lo,hi] = part.gradientZMM;
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi<=lo ||
      !Array.isArray(part.gradientRGB) || part.gradientRGB.length!==2 || part.gradientRGB.some(c => !Array.isArray(c) || c.length!==3 || c.some(v => !Number.isFinite(v)))) {
    throw new Error('Flame gradient requires increasing heights and two RGB colours');
  }
  const t = Math.max(0,Math.min(1,(p[2]-lo)/(hi-lo)));
  return { ...part, rgb: part.gradientRGB[0].map((v,i) => v*(1-t)+part.gradientRGB[1][i]*t) };
}

export function structureEmissionFlame(p, settings) {
  const flame = structureFlame(p, settings);
  if (!flame) return null;
  const inset = flame.emissionInsetMM ?? 0;
  if (!Number.isFinite(inset) || inset<0 || inset>.05) throw new Error('Flame emission inset must be between 0 and 0.05 mm');
  if (!inset) return flame;
  for (const dx of [-inset,0,inset]) for (const dy of [-inset,0,inset]) for (const dz of [-inset,0,inset]) {
    if (!structureFlame([p[0]+dx,p[1]+dy,p[2]+dz],settings)) return null;
  }
  return flame;
}

export function structureGlass(p, settings) {
  const part = (settings.surfaceParts || []).findLast(part => structureDomain(p, part));
  return part?.kind==='glass' ? part : null;
}

export function structureSurfacePigment(p, settings) {
  const part = (settings.surfaceParts || []).findLast(part => structureDomain(p, part));
  if (!['ceramic','paint','foam','plaster'].includes(part?.kind)) return null;
  let rgb = part.rgb;
  if (part.centersMM) {
    const dimensions=part.centerDimensions ?? 2;
    if (![2,3].includes(dimensions)) throw new Error('Surface colour centres require 2 or 3 dimensions');
    let nearest = 0, best = Infinity;
    part.centersMM.forEach((centre,i) => {
      const distance = p.slice(0,dimensions).reduce((sum,v,a) => sum+(v-centre[a])**2,0)/(part.centerRadiiMM?.[i] ?? 1)**2;
      if (distance<best) { best=distance; nearest=i; }
    });
    rgb = part.colorsRGB[nearest];
  }
  const variation = 1+(part.variation ?? .025)*Math.sin(p[0]*1.73+p[1]*2.31+p[2]*1.17);
  return rgb.map(c => c*variation);
}

export function structureStonePigment(p, settings) {
  if (!settings.physicalStonePigment) return null;
  if (['fabricParts','produceParts','surfaceParts','ironParts'].some(key => (settings[key] || []).some(part => structureDomain(p,part))) || structureMetal(p,settings).metallic>.01) return null;
  const part=(settings.stoneParts || []).findLast(part => structureDomain(p,part));
  if (part) {
    const variation=.5+.2*Math.sin(p[0]*.25+p[1]*.35+p[2]*.12);
    return part.darkRGB.map((v,i)=>v*(1-variation)+part.lightRGB[i]*variation);
  }
  if (p[2]<settings.stoneStartMM+settings.stoneBlendMM || (settings.woodParts || []).some(part=>structureDomain(p,part))) return null;
  const patch=.5+.23*Math.sin(p[0]*.23+p[1]*.31)+.16*Math.sin(p[0]*.49-p[1]*.19),grain=1+.035*Math.sin(p[0]*1.77+p[1]*1.39+p[2]*.53);
  return settings.stoneDarkRGB.map((v,i)=>(v*(1-patch)+settings.stoneLightRGB[i]*patch)*grain);
}

export function bakedColourShade(bytes, vertexLinear) {
  const linear=Array.from(bytes,v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});
  const luminance=v=>v[0]*.2126+v[1]*.7152+v[2]*.0722;
  const baked=luminance(linear),vertex=luminance(vertexLinear);
  return baked>1e-8&&vertex>1e-8 ? Math.max(.45,Math.min(1.2,baked/vertex)) : 1;
}

export function structureWoodPigment(p, n, settings) {
  if (!settings.woodParts?.some(part => part.physicalPigment)) return null;
  const part = (settings.woodParts || []).findLast(part => structureDomain(p,part));
  if (!part?.physicalPigment) return null;
  if (['stoneParts','fabricParts','produceParts','surfaceParts','ironParts'].some(key =>
      (settings[key] || []).some(part => structureDomain(p,part))) ||
      structureMetal(p,settings).metallic>.01) return null;
  if (part.rotationZDeg!==undefined && part.axis!=='beam') throw new Error('Physical timber pigment requires native axes');
  let u, v;
  const dot = (a,b) => a.reduce((sum,x,i) => sum+x*b[i],0);
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const unit = a => { const length=Math.hypot(...a); return a.map(x => x/length); };
  if (['log-x','log-y'].includes(part.axis)) {
    assertLogCaps(part);
    const along=part.axis==='log-x' ? 0 : 1, across=1-along;
    const centre=part.capCentersMM.reduce((best,c)=>Math.hypot(p[across]-c[across],p[2]-c[2])<Math.hypot(p[across]-best[across],p[2]-best[2])?c:best);
    const dy=(p[across]-centre[across])*(along===0 ? 1 : -1),dz=p[2]-centre[2],angle=Math.atan2(dz,dy);
    if (Math.abs(n[along])>.55 && part.endRangesMM.some(([lo,hi])=>p[along]>=lo&&p[along]<=hi)) {
      const rings=.5+.24*Math.sin(Math.hypot(dy,dz)*5.8+.1*Math.sin(angle*3));
      return part.endDarkRGB.map((c,i)=>c*(1-rings)+part.endLightRGB[i]*rings);
    }
    u=p[along];v=angle*part.grainRadiusMM;
  }
  else if (part.axis==='x') { u=p[0]; v=Math.abs(n[1])>Math.abs(n[2]) ? p[2] : p[1]; }
  else if (part.axis==='y') { u=p[1]; v=Math.abs(n[0])>Math.abs(n[2]) ? p[2] : p[0]; }
  else if (part.axis==='z') { u=p[2]; v=Math.abs(n[0])>Math.abs(n[1]) ? p[1] : p[0]; }
  else if (part.axis==='beam') {
    const d=unit(part.direction), t=unit(cross(d,Math.abs(d[0])<.8 ? [1,0,0] : [0,1,0])), other=cross(d,t);
    u=dot(p,d); v=Math.abs(dot(n,t))>Math.abs(dot(n,other)) ? dot(p,other) : dot(p,t);
  } else if (part.axis==='arc-xz' || part.axis==='arc-yz') {
    const centre=part.axis==='arc-xz' ? part.centerXZMM : part.centerYZMM;
    if (!Array.isArray(centre) || centre.length!==2 || !centre.every(Number.isFinite) ||
        !Number.isFinite(part.radiusMM) || part.radiusMM<=0) throw new Error('Measured timber arc required');
    const dx=p[part.axis==='arc-xz' ? 0 : 1]-centre[0], dz=p[2]-centre[1];
    u=Math.atan2(dz,dx)*part.radiusMM; v=Math.hypot(dx,dz);
  } else throw new Error('Unsupported physical timber grain');
  const grain=Math.max(.1,Math.min(.9,.5+.22*Math.sin(v*6.8+.12*Math.sin(u*.4))+.1*Math.sin(v*18+.04*Math.sin(u*.7))));
  const dark=part.darkRGB || settings.woodDarkRGB, light=part.lightRGB || settings.woodLightRGB;
  let variation=1+.045*Math.sin(u*.17+v*.1);
  const endAxis={x:0,y:1,z:2}[part.axis];
  if (endAxis!==undefined && Math.abs(n[endAxis])>.75) variation*=.85+.15*Math.sin(Math.hypot(v,((u%4)+4)%4)*7);
  return dark.map((c,i) => (c*(1-grain)+light[i]*grain)*variation);
}

function assertLogCaps(part) {
  if (!part.capCentersMM?.length || !part.capCentersMM.every(c=>c.length===3&&c.every(Number.isFinite)) || !Number.isFinite(part.grainRadiusMM) || part.grainRadiusMM<=0 || !part.endRangesMM?.length || !part.endDarkRGB || !part.endLightRGB) throw new Error('Measured log cap centres and palette required');
}

export function structureFabricPigment(p, settings) {
  if ((settings.surfaceParts || []).some(part => structureDomain(p,part))) return null;
  if ((settings.produceParts || []).some(part => structureDomain(p,part))) return null;
  if ((settings.ironParts || []).some(part => structureDomain(p,part))) return null;
  const part = (settings.fabricParts || []).findLast(part => structureDomain(p,part));
  if (!part || structureMetal(p,settings).metallic>.01) return null;
  let rgb = part.rgb;
  if (part.centersMM) {
    let nearest = 0, best = Infinity;
    part.centersMM.forEach((centre,i) => {
      const distance = ((p[0]-centre[0])**2+(p[1]-centre[1])**2)/(part.centerRadiiMM?.[i] ?? 1)**2;
      if (distance<best) { best=distance; nearest=i; }
    });
    rgb = part.colorsRGB[nearest];
  }
  const weave = 1+.018*Math.sin(p[0]*9)*Math.sin(p[1]*9+p[2]*11);
  return rgb.map(c => c*weave);
}

export function shouldRepairGreenSpill(pixel, vertex, p, settings) {
  return pixel[1]>pixel[0]*1.18 && vertex[1]<vertex[0]*1.05 && !structureLiquid(p, settings) && !structureGlass(p, settings);
}
