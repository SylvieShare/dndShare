import { modelVisual } from "./modelVisual";
import { hitDecalSurface } from "./decalGeometry";
import { visibleSceneHits } from "./mapScenePicking";

export function createDecalOwners(
  assets,
  runtime,
  tiles,
  preview,
  objects,
  objectPreview,
) {
  let tileItems = new Map(),
    objectItems = new Map(),
    nodes = new Map();
  function update() {
    tileItems = new Map(runtime.placedTiles.map((item) => [item.id, item]));
    objectItems = new Map(runtime.posedObjects.map((item) => [item.id, item]));
    nodes = new Map(
      [...objects.children, ...objectPreview.root.children]
        .filter((node) => node.userData.objectId)
        .map((node) => [node.userData.objectId, node]),
    );
  }
  function get(kind, id) {
    const item = (kind === "tile" ? tileItems : objectItems).get(id);
    if (!item?.modelId) return null;
    let matrix,
      tier = runtime.tier,
      visible;
    if (kind === "tile") {
      const moving = preview.transform(id);
      matrix =
        moving || (runtime.visibleScene?.tiles.has(id) && tiles.transform(id));
      if (moving) tier = runtime.options.forceLod ? "lod" : "render";
      visible = !runtime.appearance.hiddenTiles.has(id);
    } else {
      const node = nodes.get(id);
      if (node) {
        node.updateMatrixWorld(true);
        matrix = node.matrixWorld;
        tier = node.userData.tier || tier;
      }
      visible = node?.visible && !runtime.appearance.hiddenObjects.has(id);
    }
    if (!matrix) return null;
    return { matrix, source: modelVisual(assets, item.modelId, tier), visible };
  }
  function surface(ray) {
    for (const hit of visibleSceneHits(
      ray,
      [tiles.root, objects],
      runtime.appearance,
    )) {
      let anchor;
      const tile = hit.object.userData.tiles?.[hit.instanceId];
      const object = hit.object.userData.objects?.[hit.instanceId];
      if (tile) anchor = { kind: "tile", id: tile.id };
      else if (object) anchor = { kind: "object", id: object.id };
      else {
        for (let node = hit.object; node; node = node.parent)
          if (node.userData.objectId) {
            anchor = { kind: "object", id: node.userData.objectId };
            break;
          }
      }
      if (!anchor) continue;
      const owner = get(anchor.kind, anchor.id);
      if (!owner?.visible) continue;
      const local = hitDecalSurface(hit, owner.matrix);
      if (local)
        return {
          x: hit.point.x,
          y: hit.point.z,
          elevation: hit.point.y,
          decalSurface: { anchor, ...local },
        };
    }
    return null;
  }
  return { update, get, surface };
}
