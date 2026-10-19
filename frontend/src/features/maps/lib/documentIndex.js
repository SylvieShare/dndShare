import { structureContext } from "./tileStructure";

export function documentIndex(document, catalogue, context) {
  const byId = (items = []) => new Map(items.map((item) => [item.id, item]));
  const tiles = byId(document.tiles),
    objects = byId(document.objects),
    areas = byId(document.areas);
  const tileAreas = new Map(),
    objectAreas = new Map();
  for (const area of document.areas || []) {
    for (const id of area.tileIds || [])
      if (!tileAreas.has(id)) tileAreas.set(id, area);
    for (const id of area.objectIds || [])
      if (!objectAreas.has(id)) objectAreas.set(id, area);
  }
  let placement;
  return {
    tiles,
    objects,
    lights: byId(document.lights),
    areas,
    models: context?.models || byId(catalogue),
    get structure() {
      return (placement ||= {
        ...(context || structureContext(document, catalogue)),
        tilesById: tiles,
        objectsById: objects,
        areasById: areas,
        tileAreas,
        objectAreas,
      });
    },
  };
}
