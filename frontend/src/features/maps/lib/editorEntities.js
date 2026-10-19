import { lightArea, lightPose } from "./mapLighting";
import { resolvedSurfacePosition } from "./surfacePlacement";
import { tileSize } from "./tilePlacement";
import { OBJECTS } from "./mapModel";
import { documentIndex } from "./documentIndex";

export function mapEntity(
  document,
  catalogue,
  kind,
  id,
  context,
  index = documentIndex(document, catalogue, context),
) {
  const list =
    kind === "tile"
      ? index.tiles
      : kind === "object"
        ? index.objects
        : index.lights;
  const item = list.get(id);
  if (!item) return null;
  if (kind === "light") {
    const pose = lightPose(item, document, catalogue, context);
    const owner =
      item.anchor &&
      (item.anchor.kind === "tile" ? document.tiles : document.objects).find(
        (o) => o.id === item.anchor.id,
      );
    const ownerModel = catalogue.find((m) => m.id === owner?.modelId);
    const prefix =
      ownerModel?.name ||
      (owner && OBJECTS.find((o) => o.id === owner.kind)?.name) ||
      (owner ? (item.anchor.kind === "tile" ? "Плитка" : "Объект") : "");
    return {
      kind,
      id,
      item,
      name: prefix ? `${prefix} · ${item.name}` : item.name,
      namePrefix: prefix,
      color: item.color,
      enabled: item.enabled,
      areaName: document.areas.find((a) => a.id === lightArea(item, document))
        ?.name,
      position: { x: pose.x, y: pose.y, elevation: pose.worldHeight },
      groupKey: `light:${item.kind}:${item.color}`,
    };
  }
  const model = index.models.get(item.modelId),
    c = context || index.structure,
    position =
      kind === "object"
        ? resolvedSurfacePosition(item, document, catalogue, c, index)
        : {
            x: item.x,
            y: item.y,
            elevation: c.placements.get(id)?.elevation || 0,
          };
  const size = kind === "tile" && model ? tileSize(item, model) : null;
  return {
    focusPosition: size
      ? { x: position.x + size.width / 2, y: position.y + size.height / 2 }
      : position,
    kind,
    id,
    item,
    model,
    name:
      model?.name ||
      OBJECTS.find((t) => t.id === item.kind)?.name ||
      (kind === "object" ? "Объект" : "Плитка"),
    code: model?.definitionId,
    groupCode: model?.code,
    sourceName: model?.sourceName,
    previewUrl: model?.previewUrl,
    position,
    groupKey: `${kind}:${item.modelId || item.kind}`,
  };
}
export function selectedMapEntities(editor) {
  const d = editor.draft.document,
    index = editor.documentIndex || documentIndex(d, editor.catalogue),
    c = index.structure;
  return [
    ...editor.selectedTiles.map((id) =>
      mapEntity(d, editor.catalogue, "tile", id, c, index),
    ),
    ...editor.selectedObjects.map((id) =>
      mapEntity(d, editor.catalogue, "object", id, c, index),
    ),
    ...(editor.selectedLight
      ? [
          mapEntity(
            d,
            editor.catalogue,
            "light",
            editor.selectedLight,
            c,
            index,
          ),
        ]
      : []),
  ].filter(Boolean);
}
export function groupMapEntities(entries) {
  const groups = new Map();
  for (const entry of entries) {
    if (!groups.has(entry.groupKey))
      groups.set(entry.groupKey, { ...entry, members: [], count: 0 });
    const group = groups.get(entry.groupKey);
    group.members.push(entry);
    group.count++;
  }
  return [...groups.values()];
}

export function areaMapEntities(editor, area) {
  const d = editor.draft.document,
    index = editor.documentIndex || documentIndex(d, editor.catalogue),
    c = index.structure;
  return [
    ...area.tileIds.map((id) =>
      mapEntity(d, editor.catalogue, "tile", id, c, index),
    ),
    ...area.objectIds.map((id) =>
      mapEntity(d, editor.catalogue, "object", id, c, index),
    ),
    ...d.lights
      .filter((l) => lightArea(l, d) === area.id)
      .map((l) => mapEntity(d, editor.catalogue, "light", l.id, c, index)),
  ].filter(Boolean);
}
