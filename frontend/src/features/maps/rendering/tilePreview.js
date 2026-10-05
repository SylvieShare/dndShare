import { Color, Group, InstancedMesh, Matrix4 } from "three";
import { tileTransform } from "./tileTransform";
import { landingTarget } from "./tileLanding";

export function createTilePreview(assets, onSettled = () => {}) {
  const root = new Group(),
    errorColour = new Color(0xe85c8a),
    matrix = new Matrix4();
  let key = "",
    target = null,
    position = null,
    active = false,
    landing = false,
    hidden = [],
    lift = 0,
    liftTarget = 0,
    opacity = 0.7,
    opacityTarget = 0.7;
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
  function update(tile, tier, placed = []) {
    if (tile) {
      if (!active && (!tile.id || tile.id !== target?.id)) {
        position = null;
        lift = 0;
      }
      active = true;
      landing = false;
      hidden = tile.tileIds || [];
      liftTarget = tile.wallBrush
        ? 0
        : Math.max(
            0.22,
            (assets.metadata(tile.modelId)?.mountDepth || 0) + 0.05,
          );
      opacityTarget = 0.7;
      target = tile;
    } else if (target && (active || landing)) {
      const next = landingTarget(target, placed);
      target = next.target;
      hidden = next.hidden;
      active = false;
      landing = true;
      liftTarget = 0;
      opacityTarget = next.fade ? 0 : 1;
    }
    tile = target;
    root.userData.outlineStyle = tile?.wallBrush ? "hover" : "selected";
    const group = tile?.group || (tile ? [tile] : []);
    const nextKey = group.map((t) => `${t.modelId}:${tier}`).join(",");
    if (key !== nextKey) {
      clear();
      key = nextKey;
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
    const vertical = 1 - Math.exp(-delta / 80);
    position.x += (target.x - position.x) * amount;
    position.y += (target.y - position.y) * amount;
    position.elevation +=
      ((target.elevation || 0) - position.elevation) * amount;
    lift += (liftTarget - lift) * vertical;
    opacity += (opacityTarget - opacity) * vertical;
    const moving =
      Math.hypot(
        target.x - position.x,
        target.y - position.y,
        (target.elevation || 0) - position.elevation,
        liftTarget - lift,
        opacityTarget - opacity,
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
            // The insertion peg stays below the body's datum; lift is visual.
            elevation:
              (tile.elevation || 0) +
              position.elevation -
              (target.elevation || 0) +
              lift,
          },
          node.userData.metadata,
        );
        node.setMatrixAt(
          slot,
          matrix.multiplyMatrices(placement, node.userData.partMatrix),
        );
      });
      node.instanceMatrix.needsUpdate = true;
      for (const material of Array.isArray(node.material)
        ? node.material
        : [node.material])
        material.opacity = opacity;
    }
    root.updateMatrixWorld(true);
    if (landing && !moving) {
      landing = false;
      hidden = [];
      target = null;
      position = null;
      root.visible = false;
      clear();
      key = "";
      onSettled();
    }
    return moving;
  }
  function posed(id) {
    if (!landing || !position) return null;
    const tile = (target.group || [target]).find((t) => t.id === id);
    return (
      tile && {
        ...tile,
        x: tile.x + position.x - target.x,
        y: tile.y + position.y - target.y,
        elevation:
          (tile.elevation || 0) +
          position.elevation -
          (target.elevation || 0) +
          lift,
      }
    );
  }
  function hit(ray) {
    if (!landing || opacityTarget === 0) return null;
    const hit = ray.intersectObjects(root.children, false)[0];
    if (!hit) return null;
    const index = hit.object.userData.indices[hit.instanceId];
    return {
      tileId: (target.group || [target])[index].id,
      distance: hit.distance,
      point: { x: hit.point.x, y: hit.point.z, elevation: hit.point.y },
    };
  }
  return {
    root,
    update,
    advance,
    posed,
    hit,
    hiddenIds: () => hidden,
    modelIds: () =>
      new Set(
        (target?.group || (target ? [target] : [])).map((t) => t.modelId),
      ),
    destroy: clear,
  };
}
