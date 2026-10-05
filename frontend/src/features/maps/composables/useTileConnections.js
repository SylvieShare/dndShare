import { computed, ref, watch } from "vue";
import {
  connectionVariant,
  tileConnections,
  wallControlMode,
} from "../lib/tileConnections";

export function useTileConnections(editor) {
  const draftMask = ref(0);
  const tile = computed(() =>
    editor.selectedTiles.length === 1
      ? editor.draft.document.tiles.find(
          (t) => t.id === editor.selectedTiles[0],
        )
      : null,
  );
  watch(
    () =>
      tile.value && [tile.value.id, tile.value.modelId, tile.value.rotation],
    () => {
      draftMask.value = tile.value
        ? tileConnections(tile.value, editor.catalogue)
        : 0;
    },
    { immediate: true },
  );
  const invalid = computed(
    () =>
      !!tile.value &&
      !connectionVariant(tile.value, draftMask.value, editor.catalogue),
  );
  const mode = computed(() =>
    tile.value
      ? wallControlMode(
          editor.catalogue.find((m) => m.id === tile.value.modelId),
        )
      : "none",
  );
  function toggle(index) {
    if (!tile.value) return;
    draftMask.value ^= 1 << index;
    const variant = connectionVariant(
      tile.value,
      draftMask.value,
      editor.catalogue,
    );
    if (variant)
      editor.change(() =>
        Object.assign(tile.value, {
          modelId: variant.modelId,
          rotation: variant.rotation,
        }),
      );
  }
  return { mask: draftMask, invalid, toggle, mode };
}
