import { cataloguePlan } from "./model-catalogue-plan.mjs";
import { groupingFor } from "./model-grouping-plan.mjs";

// Existing catalogue decisions come from the fresh registry in currentModel.
// A newly published sculpt needs complete bilingual metadata before Go validation.
export function medievalCatalogue(model, registry) {
  const current = registry.find(
    (m) =>
      m.collection === model.collection &&
      m.sourceCode === model.sourceCode &&
      m.sourceName === model.sourceName,
  );
  if (current) return model;
  const grouping = groupingFor(model, [...registry, model]);
  if (model.tileType === "stairs") grouping.code = "MED-stair";
  if (model.tileType === "frame") {
    grouping.code = "MED-frames";
    if (/^(?:Wood2?|Rock) Level Grid /.test(model.sourceName))
      grouping.variantCode = `MED-frames-${model.width}x${model.height}-${model.wallMode}-${model.wallMask}`;
  }
  const plan = cataloguePlan([{ ...model, ...grouping }]),
    names = plan.models[0],
    labels = plan.groups[0];
  const existing = registry.find(
    (m) => m.collection === model.collection && m.code === grouping.code,
  );
  return {
    ...model,
    ...grouping,
    name: names.name,
    nameEn: names.nameEn,
    category: names.category,
    groupName: existing?.groupName || labels.name,
    groupNameEn: existing?.groupNameEn || labels.nameEn,
  };
}
