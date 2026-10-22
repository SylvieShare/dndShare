import { dependentTiles } from "../lib/tileStructure";
import { tileGroupStatus } from "../lib/tilePlacement";
import { mirrorTileGroup } from "../lib/mapGroupMirror";
import { syncSurfaceObjects } from "../lib/surfacePlacement";
export function editorGroupMirror(e) {
  return () => {
    if (e.tool.value !== "select" || !e.selectedTiles.value.length)
      return false;
    const document = e.draft.value.document;
    const ids = new Set(
      dependentTiles(document, e.catalogue.value, e.selectedTiles.value),
    );
    const tiles = document.tiles.filter((t) => ids.has(t.id));
    const mirrored = mirrorTileGroup(tiles, e.catalogue.value);
    const status = tileGroupStatus(document, mirrored, e.catalogue.value);
    if (status.valid) {
      e.change(() => {
        mirrored.forEach((tile, i) => Object.assign(tiles[i], tile));
        syncSurfaceObjects(document, e.catalogue.value);
      });
      e.error.value = "";
    } else e.error.value = status.message;
    return true;
  };
}
