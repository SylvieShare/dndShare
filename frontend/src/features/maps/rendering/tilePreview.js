import { Color, Group, InstancedMesh, Matrix4 } from "three";
import { tileTransform } from "./tileTransform";

export function createTilePreview(assets) {
  const root = new Group(),
    errorColour = new Color(0xe85c8a),
    matrix = new Matrix4();
  let key = "",
    target = null,
    position = null;
  function clear() {
    for (const node of root.children) {
      node.dispose();
      for (const material of Array.isArray(node.material)
        ? node.material
        : [node.material])
        material.dispose();
    }
    root.clear();
  }
  function update(tile, tier) {
    const group = tile?.group || (tile ? [tile] : []);
    const nextKey = group
      .map((t, index) => `${t.id || index}:${t.modelId}:${tier}`)
      .join(",");
    if (key !== nextKey) {
      clear();
      key = nextKey;
      position = null;
      const buckets = new Map();
      group.forEach((tile, index) => {
        if (!buckets.has(tile.modelId)) buckets.set(tile.modelId, []);
        buckets.get(tile.modelId).push(index);
      });
      for (const [id, indices] of buckets) {
        const metadata = assets.metadata(id),
          model = assets.model(id, tier);
        if (!metadata || !model) continue;
        for (const part of model.parts) {
          const materials = (
            Array.isArray(part.material) ? part.material : [part.material]
          ).map((m) => {
            const copy = m.clone();
            copy.transparent = true;
            copy.opacity = 0.7;
            copy.depthWrite = false;
            copy.userData.baseColor = copy.color?.clone();
            return copy;
          });
          const mesh = new InstancedMesh(
            part.geometry,
            Array.isArray(part.material) ? materials : materials[0],
            indices.length,
          );
          mesh.frustumCulled = false;
          mesh.userData = { partMatrix: part.matrix, metadata, indices };
          root.add(mesh);
        }
      }
    }
    target = tile;
    root.visible = !!tile;
    if (!tile) {
      position = null;
      return;
    }
    position ||= { x: tile.x, y: tile.y, elevation: tile.elevation || 0 };
    for (const node of root.children)
      for (const material of Array.isArray(node.material)
        ? node.material
        : [node.material])
        if (material.color)
          material.color
            .copy(material.userData.baseColor)
            .lerp(errorColour, tile.valid === false ? 0.65 : 0);
  }
  function advance(delta) {
    if (!target || !root.children.length) return false;
    const amount = 1 - Math.exp(-delta / 45);
    position.x += (target.x - position.x) * amount;
    position.y += (target.y - position.y) * amount;
    position.elevation +=
      ((target.elevation || 0) - position.elevation) * amount;
    const moving =
      Math.hypot(
        target.x - position.x,
        target.y - position.y,
        (target.elevation || 0) - position.elevation,
      ) > 0.001;
    if (!moving)
      Object.assign(position, {
        x: target.x,
        y: target.y,
        elevation: target.elevation || 0,
      });
    const group = target.group || [target];
    for (const node of root.children) {
      node.userData.indices.forEach((index, slot) => {
        const tile = group[index];
        const placement = tileTransform(
          {
            ...tile,
            x: tile.x + position.x - target.x,
            y: tile.y + position.y - target.y,
            elevation:
              (tile.elevation || 0) +
              position.elevation -
              (target.elevation || 0),
          },
          node.userData.metadata,
        );
        node.setMatrixAt(
          slot,
          matrix.multiplyMatrices(placement, node.userData.partMatrix),
        );
      });
      node.instanceMatrix.needsUpdate = true;
    }
    root.updateMatrixWorld(true);
    return moving;
  }
  return { root, update, advance, destroy: clear };
}
