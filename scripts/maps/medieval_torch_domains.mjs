// Native STL millimetres, shared by ORM packing and physical-surface QA.
import { terrainRoughness } from './medieval_structure_domains.mjs';

export function torchSurface(p, settings) {
  const spec = settings.torch;
  const radius = Math.hypot(p[0]-spec.basketCenterMM[0],p[1]-spec.basketCenterMM[1]);
  let roughness = terrainRoughness(p, settings);
  if (p.every((v,i) => v>=spec.woodMinMM[i] && v<=spec.woodMaxMM[i])) roughness = .88;
  if (p[2]>=spec.fuelMinZMM && p[2]<=spec.fuelMaxZMM && radius<spec.fuelRadiusMM) roughness = .98;
  if (spec.flameReference && torchFlameDomain(p,spec)) roughness = .9;
  const metallic = torchMetal(p, settings), weight = metallic/.92;
  return { metallic, roughness: roughness*(1-weight)+.58*weight };
}

export function torchMetal(p, settings) {
  const spec = settings.torch;
  const radius = Math.hypot(p[0]-spec.basketCenterMM[0], p[1]-spec.basketCenterMM[1]);
  let weight = 0;
  for (const part of spec.ironDomains) {
    if (p[2]>=part.zMM[0] && p[2]<=part.zMM[1] && radius>=(part.minRadiusMM || 0) && radius<=part.maxRadiusMM) weight = 1;
  }
  for (const h of settings.hardware) {
    if (p[2]<h.minZMM) continue;
    const d = p.reduce((sum,v,c) => sum+((v-h.centerMM[c])/h.radiiMM[c])**2, 0);
    weight = Math.max(weight, Math.max(0, Math.min(1, (1-d)/.2)));
  }
  return weight*.92;
}

export function torchFlameDomain(p, spec) {
  return p[2]>=spec.flameMinZMM && Math.hypot(p[0]-spec.basketCenterMM[0], p[1]-spec.basketCenterMM[1])<spec.flameRadiusMM;
}
