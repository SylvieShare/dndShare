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
  if ((part.excludeParts || []).some(excluded => structureDomain(p,excluded))) return false;
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
    if (p[2]<h.minZMM) continue;
    const d = p.reduce((sum,v,c) => sum+((v-h.centerMM[c])/h.radiiMM[c])**2, 0);
    const w = Math.max(0, Math.min(1, (1-d)/.2));
    metallic = Math.max(metallic, w*.9); roughness = roughness*(1-w)+.55*w;
  }
  return { metallic, roughness };
}
