const order = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
export function modelIdentity(model) {
  return {
    id: model.definitionId,
    code: model.code,
    variantCode: model.variantCode,
    name: model.name,
  };
}
function groupName(models, code) {
  let common = models[0]?.name.trim().split(/\s+/) || [];
  for (const model of models.slice(1)) {
    const words = model.name.trim().split(/\s+/);
    const mismatch = common.findIndex(
      (word, i) => word.toLowerCase() !== words[i]?.toLowerCase(),
    );
    if (mismatch >= 0) common = common.slice(0, mismatch);
  }
  while (/^\d+(?:x\d+)?$/i.test(common.at(-1) || "")) common.pop();
  if (common.length >= code.split("-").length - 1) return common.join(" ");
  return code
    .split("-")
    .slice(1)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}
export function modelGroups(models, catalogue = models) {
  const sections = new Map();
  for (const model of models) {
    const key = `${model.collection}:${model.code}`;
    if (!sections.has(key))
      sections.set(key, {
        key,
        code: model.code,
        collection: model.collection,
        models: [],
      });
    sections.get(key).models.push(model);
  }
  return [...sections.values()]
    .sort((a, b) => order.compare(a.code, b.code))
    .map((section) => {
      const families = new Map();
      for (const model of section.models) {
        const key = model.variantCode
          ? `variants:${model.variantCode}`
          : `model:${model.id}`;
        if (!families.has(key))
          families.set(key, {
            key: `${section.key}:${key}`,
            code: model.variantCode,
            models: [],
          });
        families.get(key).models.push(model);
      }
      return {
        ...section,
        name: groupName(
          catalogue.filter(
            (model) =>
              model.collection === section.collection &&
              model.code === section.code,
          ),
          section.code,
        ),
        variants: [...families.values()]
          .sort((a, b) =>
            order.compare(
              a.code || a.models[0].definitionId,
              b.code || b.models[0].definitionId,
            ),
          )
          .map((family) => ({
            ...family,
            models: family.models.sort((a, b) =>
              order.compare(a.definitionId, b.definitionId),
            ),
          })),
      };
    });
}
export const hasModelLight = (model) =>
  !!model.behaviour?.defaultLights?.length;
