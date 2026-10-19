import { visibleModels } from "./visibleModels";

export const MAX_TILE_TRANSITIONS = 32;

export function instanceTransitions(document, catalogue, kind, id) {
  const item = (kind === "tile" ? document.tiles : document.objects).find(
    (x) => x.id === id,
  );
  if (!item) return [];
  const current = catalogue.find((m) => m.id === item.modelId);
  const original =
    kind === "tile" &&
    item.transitions &&
    catalogue.find((m) => m.id === item.transitions.originalModelId);
  const sources = [...new Set([original, current].filter(Boolean))];
  const visible = visibleModels(catalogue);
  const defaults = sources.flatMap((source) =>
    (source.behaviour?.transitions || []).map((edge) => ({
      ...edge,
      key: `catalogue:${source.id}:${edge.id}`,
      modelId: visible.find((m) => m.definitionId === edge.toDefinitionId)?.id,
    })),
  );
  // Different source models can declare the same target/action.
  const seen = new Set();
  const result = defaults.filter((edge) => {
    const key = `${edge.toDefinitionId}:${edge.action}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (kind === "tile") {
    for (const target of item.transitions?.targets || [])
      result.push({
        ...target,
        key: `custom:${target.id}`,
        custom: true,
      });
    if (original && original.id !== current?.id)
      result.push({
        id: "return",
        key: "return",
        modelId: original.id,
        return: true,
      });
  }
  return result;
}

// Presentation only: keep every configured edge in the document. A custom edge
// wins over a catalogue edge so its edit/delete controls remain reachable.
export function displayedTransitions(document, catalogue, kind, id) {
  const current = (kind === "tile" ? document.tiles : document.objects).find(
    (item) => item.id === id,
  )?.modelId;
  const targets = new Map();
  const priority = (edge) => (edge.return ? 0 : edge.custom ? 2 : 1);
  for (const edge of instanceTransitions(document, catalogue, kind, id)) {
    const target =
      edge.modelId ||
      (edge.toDefinitionId
        ? catalogue.find((model) => model.definitionId === edge.toDefinitionId)
            ?.id || edge.toDefinitionId
        : edge.key);
    if (target === current) continue;
    if (!targets.has(target) || priority(edge) > priority(targets.get(target)))
      targets.set(target, edge);
  }
  return [...targets.values()];
}
