import { clone } from "./mapModel";
import { visibleModels } from "./visibleModels";
import { structureContext } from "./tileStructure";
import { surfacePosition, syncSurfaceObjects } from "./surfacePlacement";
import { syncLights } from "./mapLighting";

export const TRANSITION_ACTIONS = [
  { value: "open", label: "Открыть" },
  { value: "close", label: "Закрыть" },
  { value: "extinguish", label: "Погасить свет" },
  { value: "ignite", label: "Зажечь свет" },
  { value: "empty", label: "Опустошить" },
  { value: "fill", label: "Наполнить" },
];
export const transitionLabel = (action) =>
  TRANSITION_ACTIONS.find((a) => a.value === action)?.label || action;

export function transitionDocument(document, catalogue, kind, id, transition) {
  const list = kind === "tile" ? document.tiles : document.objects;
  const item = list.find((m) => m.id === id),
    source = catalogue.find((m) => m.id === item?.modelId);
  const edge = source?.behaviour?.transitions?.find(
    (t) =>
      t.id === transition.id &&
      t.action === transition.action &&
      t.toDefinitionId === transition.toDefinitionId,
  );
  const target = visibleModels(catalogue).find(
    (m) => m.definitionId === edge?.toDefinitionId,
  );
  const fail = (reason) => ({ valid: false, reason, target });
  if (
    !edge ||
    !target ||
    (target.tileType === "object") !== (kind === "object")
  )
    return fail("Целевая модель недоступна");
  const next = clone(document),
    changed = (kind === "tile" ? next.tiles : next.objects).find(
      (m) => m.id === id,
    );
  changed.modelId = target.id;
  const context = structureContext(next, catalogue);
  if (!context.status.valid) return fail(context.status.message);
  if (kind === "tile") {
    const attached = next.objects.filter((o) => o.placement?.tileId === id),
      used = new Set();
    for (const object of attached) {
      if (!target.canStand || !target.placementPoints?.length)
        return fail("На новой модели нет точек для размещённых объектов");
      const old = source.placementPoints?.[object.placement.point];
      if (!old) return fail("Исходная точка размещения отсутствует");
      const candidates = target.placementPoints
        .map((p, index) => ({ p, index }))
        .filter((p) => !used.has(p.index))
        .sort(
          (a, b) =>
            Math.hypot(a.p.x - old.x, a.p.y - old.y) -
              Math.hypot(b.p.x - old.x, b.p.y - old.y) || a.index - b.index,
        );
      if (!candidates.length)
        return fail(
          "На новой модели недостаточно точек для размещённых объектов",
        );
      const point = candidates[0];
      used.add(point.index);
      object.placement.point = point.index;
      Object.assign(
        object,
        surfacePosition(
          changed,
          target,
          point.p,
          context.placements.get(id)?.elevation || 0,
        ),
      );
    }
  }
  next.lights = (next.lights || []).filter(
    (l) => l.anchor?.kind !== kind || l.anchor.id !== id,
  );
  syncSurfaceObjects(next, catalogue);
  syncLights(next, catalogue);
  return { valid: true, reason: "", target, document: next };
}
