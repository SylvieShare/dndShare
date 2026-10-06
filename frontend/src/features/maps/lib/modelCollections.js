import { latestModelVersions } from "./modelVersions";

export function modelCollections(catalogue) {
  const packs = new Map();
  for (const model of latestModelVersions(catalogue)) {
    if (model.tileType === "object") continue;
    const pack = packs.get(model.collection) || {
      id: model.collection,
      name: model.collectionName || model.collection,
      count: 0,
    };
    pack.count++;
    packs.set(model.collection, pack);
  }
  return [...packs.values()];
}
