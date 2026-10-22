// Reviewed catalogue sections; variant families retain existing curated codes
// except known geometry families that previously combined different tile shapes.
const sectionRules = {
  MED: [
    [/^balcony(?:-|$)/, "balcony"],
    [/^ground-wood/, "ground-wood"],
    [/^ground(?:-|$)/, "ground"],
    [/^path(?:-|$)/, "path"],
    [/^bar(?:-|$)/, "bar"],
    [/^bed(?:-|$)/, "bed"],
    [/^(?:wall|window|door|wooden-arch)(?:-|$)/, "walls"],
    [/^tall-(?:angle|wall|window|door|skull-wall)(?:-|$)/, "walls"],
    [/^(?:pig|skull)-fireplace$/, "fireplaces"],
    [
      /^(?:food|bread|breads|potion|potions|rare-spice|rare-spices)(?:-|$)/,
      "market",
    ],
    [/^(?:light|chandelier)(?:-|$)/, "lights"],
  ],
  UD: [
    [/^prison(?:-|$)/, "prison"],
    [/^torture(?:-|$)/, "torture"],
    [/^small-(?:wall|angle)/, "small-walls"],
    [/^(?:wall|angle|corridor)(?:-|$)/, "walls"],
    [/^ground(?:-|$)/, "ground"],
    [/^water(?:-|$)/, "water"],
    [/^stair(?:-|$)/, "stairs"],
    [/^column(?:-|$)/, "columns"],
    [/^fountain(?:-|$)/, "fountains"],
    [/^(?:door|double-door|arch)(?:-|$)/, "passages"],
    [/^(?:level|key)(?:-|$)/, "frames"],
    [/^bridge(?:-|$)/, "bridges"],
    [/^bed(?:-|$)/, "beds"],
    [/^(?:torch|brazier)(?:-|$)/, "lights"],
    [/^autel(?:-|$)/, "altar"],
  ],
  LC: [
    [/^crystals-for-wagon$/, "wagon"],
    [/^stalagmite(?:-|$)/, "stalagmites"],
    [/^crystal(?:-|$)/, "crystals"],
    [/^bones(?:-|$)/, "bones"],
    [/^mushrooms(?:-|$)/, "mushrooms"],
    [/^(?:rocks|big-rock|rock-debris)(?:-|$)/, "rocks"],
    [/^railway(?:-|$)/, "railway"],
    [/^wagon(?:-|$)/, "wagon"],
    [/^mine(?:-|$)/, "mine"],
    [/^water(?:-|$)/, "water"],
    [/^(?:wall-to-flat-wall|flat)(?:-|$)/, "flat-walls"],
    [/^wall(?:-|$)/, "walls"],
    [/^well(?:-|$)/, "wells"],
    [
      /^(?:level|scaffolding|bridge-key|column-key|stalagmite-column-key)(?:-|$)/,
      "frames",
    ],
    [/^(?:column|stalagmite-column)(?:-|$)/, "columns"],
    [/^bridge(?:-|$)/, "bridges"],
    [/^stair(?:-|$)/, "stairs"],
  ],
  TS: [
    [/^small-wall(?:-|$)/, "small-walls"],
    [/^(?:wall|angle|corridor|corner)(?:-|$)/, "walls"],
    [/^ground(?:-|$)/, "ground"],
    [/^pipe-water(?:-|$)/, "pipes"],
    [/^water(?:-|$)/, "water"],
    [/^tunnel(?:-|$)/, "tunnels"],
    [/^wooden-bin(?:-|$)/, "bins"],
    [/^(?:box|treasure)(?:-|$)/, "containers"],
    [/^cistern(?:-|$)/, "cisterns"],
    [/^well(?:-|$)/, "wells"],
    [/^stair(?:-|$)/, "stairs"],
    [/^level(?:-|$)/, "frames"],
    [/^column(?:-|$)/, "columns"],
  ],
  MH: [
    [/^low-waterfall(?:-|$)/, "low-waterfall"],
    [/^medium-waterfall(?:-|$)/, "medium-waterfall"],
    [/^high-waterfall(?:-|$)/, "high-waterfall"],
    [/^low-water(?:-|$)/, "low-water"],
    [/^medium-water(?:-|$)/, "medium-water"],
    [/^high-water(?:-|$)/, "high-water"],
    [/^low-river(?:-|$)/, "low-river"],
    [/^medium-river(?:-|$)/, "medium-river"],
    [/^high-river(?:-|$)/, "high-river"],
    [/^low-(?:wall|angle|corridor|end|stairs)(?:-|$)/, "low-cliffs"],
    [/^medium-(?:wall|angle|corridor|end|stairs)(?:-|$)/, "medium-cliffs"],
    [
      /^high-(?:wall|angle|corridor|end|stairs|step|grotto)(?:-|$)/,
      "high-cliffs",
    ],
    [/^dirt-ground(?:-|$)/, "dirt-ground"],
    [/^dirt-path(?:-|$)/, "dirt-path"],
    [/^(?:grass|dirt-grass|pines|giant-pine|mushrooms)(?:-|$)/, "vegetation"],
    [/^(?:little-rock|big-rock|small-crater)(?:-|$)/, "rocks"],
    [/^dragon(?:-|$)/, "dragon-bones"],
    [
      /^(?:(?:small|medium|tall)-ruins|bridge-ruins|cart-ruins)(?:-|$)/,
      "ruins",
    ],
    [/^wooden-bridge(?:-|$)/, "wooden-bridges"],
    [/^bridge(?:-|$)/, "bridges"],
    [/^river(?:-|$)/, "river"],
    [/^water(?:-|$)/, "water"],
    [
      /^(?:db-wall|light-level|rock-level|grid-adaptor|lock-grid)(?:-|$)/,
      "frames",
    ],
  ],
  BE: [
    [/^border(?:-|$)/, "border"],
    [/^(?:grid|key|stair-support)(?:-|$)/, "frames"],
  ],
};
const splitByName = new Set([
  "MED-ground-corner",
  "MED-seating",
  "MH-db-wall",
  "MH-light-level",
  "MH-rock-level",
  "MH-scenic-level",
]);
const slug = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
export function groupingFor(model, catalogue) {
  if (model.variantCode)
    return { code: model.code, variantCode: model.variantCode };
  const [prefix, ...parts] = model.code.split("-");
  const family = parts.join("-");
  let code = `${prefix}-${sectionRules[prefix]?.find(([pattern]) => pattern.test(family))?.[1] || family}`;
  let variantCode = model.variantCode || model.code;
  if (model.code === "MED-bar") {
    variantCode =
      "MED-" +
      (/^Tall Bar Angle/.test(model.name)
        ? "tall-bar-angle"
        : /^Bar Angle/.test(model.name)
          ? "bar-angle"
          : /^Tall Bar/.test(model.name)
            ? "tall-bar"
            : "bar");
  } else if (splitByName.has(model.code)) {
    variantCode = `${prefix}-${slug(model.sourceName)}`;
  } else if (
    prefix === "MH" &&
    /-(pines|branches)$/.test(family) &&
    catalogue.some(
      (other) => other.code === model.code.replace(/-(pines|branches)$/, ""),
    )
  ) {
    variantCode = model.code.replace(/-(pines|branches)$/, "");
  }
  // Frames of different sizes and different wall connections are separate cards.
  const siblings = catalogue.filter((other) => other.code === model.code);
  const shape = (other) =>
    `${other.width}x${other.height}:${other.tileType}:${other.wallMode}:${other.wallMask}`;
  if (
    new Set(siblings.map(shape)).size > 1 &&
    !splitByName.has(model.code) &&
    model.code !== "MED-bar"
  ) {
    variantCode += `-${model.width}x${model.height}-${model.tileType}-${model.wallMode}-${model.wallMask}`;
  }
  return { code, variantCode };
}
export function groupingPlan(models) {
  return models.map((model) => ({
    definitionId: model.definitionId,
    expectedCode: model.code,
    expectedVariantCode: model.variantCode || "",
    ...groupingFor(model, models),
  }));
}
