import { uid } from "./mapModel";

const key = (item) =>
  `${item.anchor?.kind}:${item.anchor?.id}:${item.builtinKey}`;
function owners(document, catalogue) {
  const models = new Map(catalogue.map((m) => [m.id, m]));
  return ["tile", "object"].flatMap((kind) =>
    (kind === "tile" ? document.tiles : document.objects).map((item) => ({
      item,
      kind,
      model: models.get(item.modelId),
    })),
  );
}
export function builtinFlagId(document, anchor, flagKey) {
  return flagKey
    ? document.flags?.find(
        (f) =>
          f.builtinKey === flagKey &&
          f.anchor?.kind === anchor.kind &&
          f.anchor.id === anchor.id,
      )?.id || ""
    : "";
}
export function syncBuiltinFlags(document, catalogue) {
  const previous = new Map(
    (document.flags || []).filter((f) => f.builtinKey).map((f) => [key(f), f]),
  );
  const flags = (document.flags || []).filter((f) => !f.builtinKey);
  for (const { item, kind, model } of owners(document, catalogue))
    for (const template of model?.behaviour?.defaultFlags || []) {
      const anchor = { kind, id: item.id },
        old = previous.get(key({ anchor, builtinKey: template.key }));
      flags.push({
        id: old?.id || uid(),
        name: old?.name || template.name,
        enabled: old?.enabled ?? template.enabled,
        builtinKey: template.key,
        anchor,
      });
    }
  document.flags = flags;
}
export function syncBuiltinEffects(document, catalogue) {
  const previous = new Map(
    (document.effects || [])
      .filter((f) => f.builtinKey)
      .map((f) => [key(f), f]),
  );
  const effects = (document.effects || []).filter((f) => !f.builtinKey);
  for (const { item, kind, model } of owners(document, catalogue))
    for (const template of model?.behaviour?.defaultEffects || []) {
      const anchor = { kind, id: item.id },
        old = previous.get(key({ anchor, builtinKey: template.key })),
        scale = kind === "object" ? item.scale || 1 : 1;
      effects.push({
        id: old?.id || uid(),
        name: template.name,
        kind: template.kind,
        color: template.color,
        size: template.size.map((v) => v * scale),
        strength: template.strength,
        x: old?.x || 0,
        y: old?.y || 0,
        elevation: old?.elevation || 0,
        height: template.position[2] * scale,
        offset: [0, 0],
        enabled: old?.enabled ?? template.enabled,
        builtinKey: template.key,
        anchor,
        flagId: builtinFlagId(document, anchor, template.flagKey),
        overrides: old?.overrides && { ...old.overrides },
        ...(old?.overrides || {}),
      });
    }
  document.effects = effects;
}
