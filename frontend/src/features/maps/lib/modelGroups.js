const order = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
export function modelIdentity(model) {
  return { id: model.definitionId, code: model.code, name: model.name };
}
export function modelGroups(models) {
  const groups = new Map();
  for (const model of models) {
    const key = `${model.collection}:${model.code}`;
    if (!groups.has(key))
      groups.set(key, { key, code: model.code, models: [] });
    groups.get(key).models.push(model);
  }
  return [...groups.values()]
    .sort((a, b) => order.compare(a.code, b.code))
    .map((group) => ({
      ...group,
      models: group.models.sort((a, b) =>
        order.compare(a.definitionId, b.definitionId),
      ),
    }));
}
export const hasModelLight = (model) =>
  !!model.behaviour?.defaultLights?.length;
