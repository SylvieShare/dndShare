const defaults = {
  "ktx-balanced": [1536, 1024, 768, 512],
  "ktx-compact": [1024, 1024, 512, 512],
};
export function caveTexturePlan(spec, name) {
  if (!defaults[name]) throw new Error("Known cave texture candidate required");
  const plan = spec.textureCandidates?.[name] ?? defaults[name];
  if (
    !Array.isArray(plan) ||
    plan.length !== 4 ||
    plan.some((v) => !Number.isInteger(v) || v < 128 || v > 2048)
  )
    throw new Error("Four reviewed texture sizes between128 and2048 required");
  return [...plan];
}
