import { dependentTiles } from "../lib/tileStructure";
import { tileGroupStatus } from "../lib/tilePlacement";
import { groupRotationPivot, rotateMapGroup } from "../lib/mapGroupRotation";
import { syncSurfaceObjects } from "../lib/surfacePlacement";

export function editorGroupRotation(e) {
  let previous = "",
    pivot;
  return function rotate() {
    const document = e.draft.value.document;
    const ids = new Set(
      dependentTiles(document, e.catalogue.value, e.selectedTiles.value),
    );
    const tiles = document.tiles.filter((t) => ids.has(t.id));
    if (!tiles.length || e.tool.value !== "select") return false;
    const key = JSON.stringify(tiles);
    if (previous !== key)
      pivot = groupRotationPivot(tiles, [], e.catalogue.value);
    const rotated =
      tiles.length === 1
        ? tiles.map((t) => ({ ...t, rotation: (t.rotation + 90) % 360 }))
        : rotateMapGroup(tiles, [], e.catalogue.value, pivot).tiles;
    const status = tileGroupStatus(document, rotated, e.catalogue.value);
    if (status.valid) {
      e.change(() => {
        rotated.forEach((t, i) => Object.assign(tiles[i], t));
        document.objects
          .filter(
            (o) =>
              e.selectedObjects.value.includes(o.id) ||
              ids.has(o.placement?.tileId),
          )
          .forEach((o) => {
            o.rotation = (o.rotation + 90) % 360;
          });
        syncSurfaceObjects(document, e.catalogue.value);
      });
      previous = JSON.stringify(rotated);
      e.error.value = "";
    } else e.error.value = status.message;
    return true;
  };
}
