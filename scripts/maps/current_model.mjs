import { randomUUID } from "node:crypto";
// Assign a UUID once, then retain the registry identity for every publication.
export function currentModel(model, registry, assets) {
  const current = registry.find(
    (m) =>
      m.collection === model.collection &&
      m.sourceCode === model.sourceCode &&
      m.sourceName === model.sourceName,
  );
  const { version, ...metadata } = model;
  if (
    current &&
    model.definitionId &&
    current.definitionId !== model.definitionId
  )
    throw new Error("Logical model identity changed; refresh the registry");
  return {
    ...metadata,
    id: current?.id || model.id || randomUUID(),
    ...(current
      ? {
          definitionId: current.definitionId,
          code: current.code,
          variantCode: current.variantCode,
          name: current.name,
          nameEn: current.nameEn,
          groupName: current.groupName,
          groupNameEn: current.groupNameEn,
          category: current.category,
          hidden: current.hidden,
        }
      : {}),
    placementPoints: (metadata.placementPoints || []).map(point => {
      const registered=current?.placementPoints?.find(p=>p.x===point.x && p.y===point.y);
      const cell=registered?.cell || point.cell;
      if(!cell) throw new Error("Placement point needs an explicit local cell");
      return {...point,cell:{...cell}};
    }),
    assets,
  };
}
