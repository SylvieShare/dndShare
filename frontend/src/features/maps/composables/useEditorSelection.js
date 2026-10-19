import { computed, ref } from "vue";

export function useEditorSelection() {
  const state = ref({ tiles: [], objects: [], primaryTile: "" });
  const selectedTiles = computed(() => state.value.tiles);
  const selectedObjects = computed(() => state.value.objects);
  const selectedTile = computed({
    get: () =>
      state.value.tiles.includes(state.value.primaryTile)
        ? state.value.primaryTile
        : state.value.tiles[0] || "",
    set(id) {
      if (id && !state.value.tiles.includes(id))
        state.value.tiles = [...state.value.tiles, id];
      state.value.primaryTile = id;
    },
  });
  return {
    selectedTiles,
    selectedObjects,
    selectedTile,
    selectedObject: computed(() => state.value.objects[0] || ""),
    setTileSelection(ids, primary = ids[0] || "") {
      state.value.tiles = [...new Set(ids)];
      state.value.primaryTile = primary;
    },
    setObjectSelection(ids) {
      state.value.objects = [...new Set(ids)];
    },
  };
}
