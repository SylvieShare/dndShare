export const flagEnabled = (document, id) =>
  !id || !!document.flags?.find((f) => f.id === id)?.enabled;
export const componentEnabled = (document, item) =>
  !!item.enabled && flagEnabled(document, item.flagId);

export function pruneComponentLinks(document) {
  const tiles = new Set(document.tiles.map((t) => t.id)),
    objects = new Set(document.objects.map((o) => o.id)),
    exists = (item) =>
      !item.anchor ||
      (item.anchor.kind === "tile" ? tiles : objects).has(item.anchor.id);
  document.flags = (document.flags || []).filter(exists);
  document.effects = (document.effects || []).filter(exists);
  const flags = new Set(document.flags.map((f) => f.id));
  for (const item of [...(document.lights || []), ...document.effects]) {
    if (item.flagId && !flags.has(item.flagId)) {
      item.flagId = "";
      if (item.overrides) delete item.overrides.flagId;
    }
  }
}
