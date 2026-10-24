import { Group, Matrix4, Mesh } from "three";
import { buildMapProp, disposeObjects } from "./sceneObjects";
import { buildMapToken } from "./sceneTokens";
import { visibilityAt } from "../lib/mapModel";
import { createModelBatches } from "./modelBatches";
import { applyAreaOpacity } from "./areaOpacity";
import { modelVisual, visualSignature } from "./modelVisual";
import { tokenModelId } from "../lib/tokenModels";
import { tokenBaseModel } from "../lib/tokenBases";

// Stable logical roots serve motion/attachments; repeated props share GPU draws.
export function createSceneObjectLayer(assets, fog, portraits) {
  const root = new Group(),
    records = new Map(),
    masks = new Map();
  root.matrixAutoUpdate = false;
  const batches = createModelBatches(root, assets, fog, "objects");
  const pose = new Matrix4();
  let appearance;
  function release(id, record) {
    root.remove(record.node);
    disposeObjects(record.node);
    records.delete(id);
    masks.delete(record.node.userData.objectId);
  }
  function transform(node, item) {
    node.position.set(item.x, item.elevation || 0, item.y);
    node.rotation.y = (-(item.rotation || 0) * Math.PI) / 180;
    node.scale.setScalar(item.scale || 1);
    node.updateMatrix();
  }
  return {
    root,
    update(document, state, options, tier, nextAppearance) {
      appearance = nextAppearance;
      const keep = new Set(),
        groups = new Map();
      portraits.retain(state?.tokens || []);
      function reconcile(id, stamp, build) {
        keep.add(id);
        let record = records.get(id);
        if (record?.stamp !== stamp) {
          if (record) release(id, record);
          record = { stamp, node: build() };
          record.node.traverse((node) => {
            // GLB parts already carry their native matrix, including scale.
            // Composing it from default position/rotation would erase it.
            if (node.matrixAutoUpdate) node.updateMatrix();
            node.matrixAutoUpdate = false;
          });
          records.set(id, record);
          root.add(record.node);
        }
        return record.node;
      }
      for (const item of document.objects) {
        const key = `object:${item.id}`;
        const node = reconcile(
          key,
          `${item.modelId || item.kind}:${item.modelId ? "" : (state?.objects?.[item.id] ?? item.open)}`,
          () => {
            if (!item.modelId)
              return buildMapProp(
                item,
                state?.objects?.[item.id] ?? item.open,
                fog,
                assets,
                tier,
              );
            const group = new Group();
            group.userData.objectId = item.id;
            return group;
          },
        );
        transform(node, item);
        node.visible = appearance.objectOpacity(item.id) > 0.001;
        if (!item.modelId)
          applyAreaOpacity(node, appearance.objectOpacity(item.id));
        else {
          const quality = options.forceLod
            ? "lod"
            : options.renderObjects?.includes(item.id)
              ? "render"
              : tier;
          const bucket = `${item.modelId}:${quality}:${Math.floor(item.x / 12)},${Math.floor(item.y / 12)}:${appearance.objectGroup(item.id)}`;
          if (!groups.has(bucket))
            groups.set(bucket, {
              modelId: item.modelId,
              tier: quality,
              items: [],
              pose: (object) => {
                const visual = records.get(`object:${object.id}`).node;
                visual.updateMatrix();
                return pose.copy(visual.matrix);
              },
              opacity: appearance.objectOpacity(item.id),
            });
          groups.get(bucket).items.push(item);
          node.userData.modelId = item.modelId;
          node.userData.tier = quality;
        }
      }
      for (const item of state?.tokens || []) {
        if (
          !options.master &&
          (item.hidden ||
            item.physical ||
            visibilityAt(document, state, item.x, item.y) !== "visible")
        )
          continue;
        const { x, y, elevation, rotation, mirrored, ...visual } = item;
        const modelId = tokenModelId(item, assets.catalogue?.() || []);
        const base = tokenBaseModel(item, state, assets.catalogue?.() || []);
        const stamp = JSON.stringify([
          visual,
          options.selectedToken === item.id,
          modelId && visualSignature(assets, new Set([modelId, base?.id].filter(Boolean)), tier),
          !!state?.useCreatureBases,
        ]);
        const node = reconcile(`token:${item.id}`, stamp, () =>
          buildMapToken(
            item,
            { ...options, state, assets, tier, tokenPortraits: portraits },
            fog,
          ),
        );
        node.userData.placementTileId = item.placement?.tileId;
        node.position.set(x, (elevation || 0) + 0.05, y);
        node.scale.x = mirrored ? -1 : 1;
        node.updateMatrix();
        applyAreaOpacity(node, appearance.tokenOpacity(item.placement?.tileId));
      }
      for (const [id, record] of records)
        if (!keep.has(id)) release(id, record);
      batches.sync(groups);
      root.updateMatrixWorld(true);
    },
    advance(ids) {
      return batches.advance(ids);
    },
    applyAppearance() {
      if (!appearance) return;
      batches.applyAppearance(appearance.objectOpacity, appearance.objectFlash);
    },
    outlineSources(nodes) {
      const keep = new Set();
      const result = nodes.map((node) => {
        if (node.userData.tokenId) {
          const body = node.children.find((child) => child.userData.tokenBody);
          if (!body) return node;
          body.userData.outlineType = node.userData.outlineType;
          body.userData.outlineStyle = node.userData.outlineStyle;
          return body;
        }
        if (!node.userData.modelId) return node;
        const id = node.userData.objectId;
        keep.add(id);
        const source = modelVisual(
          assets,
          node.userData.modelId,
          node.userData.tier,
        );
        let mask = masks.get(id);
        if (!mask || mask.source !== source) {
          const group = new Group();
          group.matrixAutoUpdate = false;
          for (const part of source?.parts || []) {
            const mesh = new Mesh(part.geometry, part.material);
            mesh.matrixAutoUpdate = false;
            mesh.matrix.copy(part.matrix);
            group.add(mesh);
          }
          mask = { source, group };
          masks.set(id, mask);
        }
        node.updateMatrixWorld(true);
        mask.group.matrix.copy(node.matrixWorld);
        mask.group.userData = { ...node.userData };
        mask.group.updateMatrixWorld(true);
        return mask.group;
      });
      for (const id of masks.keys()) if (!keep.has(id)) masks.delete(id);
      return result;
    },
    destroy() {
      batches.destroy();
      for (const [id, record] of records) release(id, record);
      masks.clear();
    },
  };
}
