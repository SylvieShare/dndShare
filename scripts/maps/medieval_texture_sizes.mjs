// Per-model texture budgets, preserving the established sizes when omitted.
export function medievalTextureSizes(recipe, tier, candidate) {
  if (!["render", "lod"].includes(tier))
    throw new Error("Unknown texture tier");
  if (candidate !== undefined && candidate !== "compact")
    throw new Error("Unknown texture candidate");
  const scale = candidate === "compact" ? 0.75 : 1;
  const bake = recipe[tier + "BakeSize"];
  const requestedSize = (kind) => {
    const value = recipe[tier + kind + "Size"];
    if (value === undefined) return undefined;
    if (
      !Number.isInteger(value) ||
      value < 4 ||
      !Number.isInteger(bake) ||
      value > bake ||
      !Number.isInteger(value * scale)
    ) {
      throw new Error(
        kind +
          " map size must be an integer within the source bake, including the compact scale",
      );
    }
    return value * scale;
  };
  const colourSize =
    requestedSize("Colour") ?? (tier === "render" ? 1024 : 512) * scale;
  const dataSize = requestedSize("Data") ?? colourSize / 2;
  if (!Number.isInteger(dataSize) || dataSize < 1)
    throw new Error("Data map size must be a positive integer");
  return { colourSize, dataSize };
}

export function medievalColourQuality(recipe, tier) {
  if (!["render", "lod"].includes(tier))
    throw new Error("Unknown texture tier");
  const value = recipe[tier + "ColourQuality"] ?? 94;
  if (!Number.isInteger(value) || value < 1 || value > 100)
    throw new Error("Colour quality must be an integer from 1 to 100");
  return value;
}
