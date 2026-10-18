import { transitionDocument } from "../lib/modelTransitions";
import { MAX_TILE_TRANSITIONS } from "../lib/instanceTransitions";
import { uid } from "../lib/mapModel";
export function editorTransitions(e) {
  function updateTargets(id, update) {
    if (!e.draft.value.document.tiles.some((t) => t.id === id)) return;
    e.change((m) => {
      const tile = m.document.tiles.find((t) => t.id === id);
      tile.transitions ||= { originalModelId: tile.modelId, targets: [] };
      update(tile.transitions.targets, tile);
    });
  }
  function addTransition(id) {
    const tile = e.draft.value.document.tiles.find((t) => t.id === id);
    if (
      !tile ||
      (tile.transitions?.targets.length || 0) >= MAX_TILE_TRANSITIONS
    )
      return;
    const key = uid();
    updateTargets(id, (targets) => targets.push({ id: key }));
    return key;
  }
  function setTransitionTarget(id, key, modelId) {
    const tile = e.draft.value.document.tiles.find((t) => t.id === id);
    const model = e.catalogue.value.find(
      (m) => m.id === modelId && m.tileType !== "object" && !m.hidden,
    );
    if (
      !tile ||
      !model ||
      model.id === tile.modelId ||
      !tile.transitions?.targets.some((t) => t.id === key) ||
      tile.transitions?.targets.some(
        (t) => t.id !== key && t.modelId === modelId,
      )
    )
      return;
    updateTargets(id, (targets) => {
      const target = targets.find((t) => t.id === key);
      if (target) target.modelId = modelId;
    });
  }
  function removeTransition(id, key) {
    if (
      !e.draft.value.document.tiles
        .find((t) => t.id === id)
        ?.transitions?.targets.some((t) => t.id === key)
    )
      return;
    updateTargets(id, (targets) => {
      const index = targets.findIndex((t) => t.id === key);
      if (index >= 0) targets.splice(index, 1);
    });
  }
  function applyTransition(kind, id, transition) {
    const result = transitionDocument(
      e.draft.value.document,
      e.catalogue.value,
      kind,
      id,
      transition,
    );
    if (!result.valid) {
      e.error.value = result.reason;
      return;
    }
    e.error.value = "";
    e.change((m) => {
      m.document = result.document;
    });
  }
  return {
    applyTransition,
    addTransition,
    setTransitionTarget,
    removeTransition,
  };
}
