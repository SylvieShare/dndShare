import { WALL_TYPES } from "./tileCategories";
const order = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
export function modelIdentity(model) {
  return {
    id: model.definitionId,
    code: model.code,
    variantCode: model.variantCode,
    name: model.name,
  };
}
export function modelGroups(models, { wallSubcategories = false } = {}) {
  const sections = new Map();
  for (const model of models || []) {
    const key = `${model.collection}:${model.code}`;
    if (!sections.has(key))
      sections.set(key, {
        key,
        code: model.code,
        collection: model.collection,
        name: model.groupName,
        models: [],
      });
    sections.get(key).models.push(model);
  }
  return [...sections.values()]
    .sort((a, b) => order.compare(a.code, b.code))
    .map((section) => {
      const sorted = section.models.sort(
        (a, b) =>
          order.compare(
            a.variantCode || a.definitionId,
            b.variantCode || b.definitionId,
          ) || order.compare(a.definitionId, b.definitionId),
      );
      return {
        ...section,
        models: sorted,
        subsections: wallSubcategories
          ? WALL_TYPES.map((type) => ({
              key: type.value,
              name: type.label,
              models: sorted.filter((m) => m.tileType === type.value),
            })).filter((s) => s.models.length)
          : [{ key: "models", name: "", models: sorted }],
      };
    });
}
export const hasModelLight = (model) =>
  !!model.behaviour?.defaultLights?.length;
