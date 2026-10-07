import { ref } from "vue";
export function editorLightBinding(e, selectedLight, bindLight) {
  const bindingLight = ref("");
  let consumed = false;
  function cancelLightBinding() {
    bindingLight.value = "";
    consumed = false;
    if (e.tool.value === "bind-light") e.tool.value = "select";
    e.hoveredTile.value = "";
    e.hoveredObject.value = "";
  }
  function beginLightBinding(id) {
    if (
      !e.draft.value.document.lights.some((l) => l.id === id && !l.builtinKey)
    )
      return;
    selectedLight.value = id;
    e.setTileSelection([]);
    e.setObjectSelection([]);
    e.tool.value = "bind-light";
    bindingLight.value = id;
  }
  function handleBinding({ phase, hit }) {
    if (!bindingLight.value && !consumed) return false;
    if (phase === "cancel") {
      cancelLightBinding();
      return true;
    }
    if (phase === "hover") {
      e.hoveredTile.value = hit?.tileId || "";
      e.hoveredObject.value = hit?.objectId || "";
      return true;
    }
    if (phase === "start" && bindingLight.value) {
      const anchor = hit?.tileId
        ? { kind: "tile", id: hit.tileId }
        : hit?.objectId
          ? { kind: "object", id: hit.objectId }
          : null;
      if (
        anchor &&
        (anchor.kind === "tile"
          ? e.draft.value.document.tiles
          : e.draft.value.document.objects
        ).some((m) => m.id === anchor.id)
      ) {
        bindLight(bindingLight.value, anchor);
        bindingLight.value = "";
        e.tool.value = "select";
        consumed = true;
      }
    }
    if (phase === "end") consumed = false;
    return true;
  }
  return { bindingLight, beginLightBinding, cancelLightBinding, handleBinding };
}
