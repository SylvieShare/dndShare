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
    if (part.axis==='log-x' && part.endRangesMM.some(([lo,hi]) => p[0]>=lo && p[0]<=hi)) roughness = part.endRoughness;
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
  return part?.kind==='flame' ? part : null;
}

export function structureGlass(p, settings) {
  const part = (settings.surfaceParts || []).findLast(part => structureDomain(p, part));
  return part?.kind==='glass' ? part : null;
}

export function structureSurfacePigment(p, settings) {
  const part = (settings.surfaceParts || []).findLast(part => structureDomain(p, part));
  if (!['ceramic','paint','foam'].includes(part?.kind)) return null;
  let rgb = part.rgb;
  if (part.centersMM) {
    let nearest = 0, best = Infinity;
    part.centersMM.forEach((centre,i) => {
      const distance = ((p[0]-centre[0])**2+(p[1]-centre[1])**2)/(part.centerRadiiMM?.[i] ?? 1)**2;
      if (distance<best) { best=distance; nearest=i; }
    });
    rgb = part.colorsRGB[nearest];
  }
  const variation = 1+(part.variation ?? .025)*Math.sin(p[0]*1.73+p[1]*2.31+p[2]*1.17);
  return rgb.map(c => c*variation);
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
  if (part.axis==='x') { u=p[0]; v=Math.abs(n[1])>Math.abs(n[2]) ? p[2] : p[1]; }
  else if (part.axis==='y') { u=p[1]; v=Math.abs(n[0])>Math.abs(n[2]) ? p[2] : p[0]; }
  else if (part.axis==='z') { u=p[2]; v=Math.abs(n[0])>Math.abs(n[1]) ? p[1] : p[0]; }
  else if (part.axis==='beam') {
    const d=unit(part.direction), t=unit(cross(d,Math.abs(d[0])<.8 ? [1,0,0] : [0,1,0])), other=cross(d,t);
    u=dot(p,d); v=Math.abs(dot(n,t))>Math.abs(dot(n,other)) ? dot(p,other) : dot(p,t);
  } else throw new Error('Unsupported physical timber grain');
  const grain=Math.max(.1,Math.min(.9,.5+.22*Math.sin(v*6.8+.12*Math.sin(u*.4))+.1*Math.sin(v*18+.04*Math.sin(u*.7))));
  const dark=part.darkRGB || settings.woodDarkRGB, light=part.lightRGB || settings.woodLightRGB;
  let variation=1+.045*Math.sin(u*.17+v*.1);
  const endAxis={x:0,y:1,z:2}[part.axis];
  if (endAxis!==undefined && Math.abs(n[endAxis])>.75) variation*=.85+.15*Math.sin(Math.hypot(v,((u%4)+4)%4)*7);
  return dark.map((c,i) => (c*(1-grain)+light[i]*grain)*variation);
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
