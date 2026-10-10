export function structureDomain(p, part) {
  if (p.some((v,i) => v<part.minMM[i] || v>part.maxMM[i])) return false;
  if (part.absYMM && (Math.abs(p[1])<part.absYMM[0] || Math.abs(p[1])>part.absYMM[1])) return false;
  if (part.projection) {
    const s = part.projection, t = p.reduce((sum,v,i) => sum+(v-s.originMM[i])*s.axis[i], 0);
    if (t<s.rangeMM[0] || t>s.rangeMM[1]) return false;
  }
  return true;
}

export function structureMetal(p, settings) {
  let metallic = 0, roughness = .9;
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
