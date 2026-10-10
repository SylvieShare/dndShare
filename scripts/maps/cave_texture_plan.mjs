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

export function caveTextureSize(spec, plan, tier, slot) {
  const ti = tier === "render" ? 0 : tier === "lod" ? 1 : -1;
  if (ti < 0) throw new Error("Known cave texture tier required");
  if (slot === "MetallicRoughness" && spec.ormTextureSizes) {
    const values = spec.ormTextureSizes;
    if (
      !Array.isArray(values) ||
      values.length !== 2 ||
      values.some(
        (v, i) =>
          !Number.isInteger(v) ||
          v < 128 ||
          v > 2048 ||
          v > (spec[i ? "lodBakeSize" : "renderBakeSize"] ?? 2048),
      )
    )
      throw new Error(
        "Two reviewed ORM sizes no larger than the source bake required",
      );
    return values[ti];
  }
  return plan[ti * 2 + (["BaseColor", "Emissive"].includes(slot) ? 0 : 1)];
}
