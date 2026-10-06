import {
  Group,
  InstancedMesh,
  Matrix4,
  Vector3,
  Mesh,
  MeshBasicMaterial,
  DoubleSide,
  DynamicDrawUsage,
} from "three";
import { tileTransform } from "./tileTransform";
import { hiddenAreaMembers } from "../lib/mapAreas";

// The shadow asset shares the visible model's local coordinate system. Never
// extrude gameplay blocker polygons: they fill stairs, bowls and door openings.
export function createShadowProxies(assets) {
  const root = new Group(),
    material = new MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  material.shadowSide = DoubleSide;
  const matrix = new Matrix4(),
    previous = new Matrix4();
  let key = "",
    batches = [],
    legacy = [];
  function clear() {
    root.traverse((node) => {
      if (node.isInstancedMesh) node.dispose();
    });
    root.clear();
    batches = [];
    legacy = [];
  }
  function update(
    document,
    placed,
    objects,
    options,
    objectRoot,
    objectPreview,
  ) {
    const hidden = hiddenAreaMembers(document),
      ignored = new Set(options.previewTile?.tileIds || []);
    const tiles = [
      ...placed.filter((t) => !ignored.has(t.id)),
      ...(options.previewTile?.group || []),
    ]
      .map((t, i) => ({ ...t, id: t.id || i }))
      .filter((t) => !hidden.tiles.has(t.id));
    const previews = (
      options.previewObject?.group ||
      (options.previewObject ? [options.previewObject] : [])
    ).map((o, i) => ({
      ...o,
      id: o.id || `shadow-object-${i}`,
      previewIndex: i,
    }));
    const previewIds = new Set(previews.map((o) => o.id));
    const props = [
      ...objects.filter((o) => !previewIds.has(o.id)),
      ...previews,
    ].filter((o) => !hidden.objects.has(o.id));
    const buckets = new Map();
    for (const item of [
      ...tiles.map((tile) => ({ tile, model: assets.metadata(tile.modelId) })),
      ...props.filter((o) => o.modelId).map((object) => ({ object })),
    ]) {
      const instance = item.tile || item.object;
      const id = instance.modelId;
      const source = assets.model(id, "shadow");
      if (!source || (item.tile && !item.model)) continue;
      const bucket = `${id}:${Math.floor(instance.x / 8)},${Math.floor(instance.y / 8)}`;
      if (!buckets.has(bucket)) buckets.set(bucket, { source, items: [] });
      buckets.get(bucket).items.push(item);
    }
    const primitives = new Map(
      [...(objectRoot?.children || []), ...(objectPreview?.children || [])]
        .filter((o) =>
          props.some((p) => !p.modelId && p.id === o.userData.objectId),
        )
        .map((o) => [o.userData.objectId, o]),
    );
    const next = JSON.stringify([
      [...buckets].map(([id, { source, items }]) => [
        id,
        source.parts.map((p) => p.geometry.id),
        items.map((item) => (item.tile || item.object).id),
      ]),
      [...primitives].map(([id, visual]) => [id, visual.uuid]),
    ]);
    if (next !== key) {
      clear();
      key = next;
      for (const [bucket, { source, items }] of buckets) {
        for (const part of source.parts) {
          const mesh = new InstancedMesh(part.geometry, material, items.length);
          mesh.castShadow = true;
          // WebGL invokes onBeforeShadow separately. Keep the invisible shadow
          // geometry out of the normal color pass without extra vertex work.
          mesh.onBeforeRender = () => {
            mesh.count = 0;
          };
          mesh.onAfterRender = () => {
            mesh.count = items.length;
          };
          mesh.instanceMatrix.setUsage(DynamicDrawUsage);
          root.add(mesh);
          batches.push({ mesh, part, items, bucket });
        }
      }
      for (const visual of primitives.values()) {
        visual.updateMatrixWorld(true);
        const inverse = visual.matrixWorld.clone().invert(),
          group = new Group();
        group.matrixAutoUpdate = false;
        visual.traverse((node) => {
          if (!node.isMesh) return;
          const mesh = new Mesh(node.geometry, material);
          mesh.castShadow = true;
          mesh.matrixAutoUpdate = false;
          mesh.matrix.multiplyMatrices(inverse, node.matrixWorld);
          group.add(mesh);
        });
        root.add(group);
        legacy.push({ group, visual });
      }
    } else {
      for (const batch of batches) {
        batch.items = buckets.get(batch.bucket).items;
      }
    }
    return next;
  }
  function advance(tileMatrix, objects, objectPreview) {
    let changed = false;
    const objectRoots = new Map(
      objects.children.map((o) => [o.userData.objectId, o]),
    );
    for (const { mesh, part, items } of batches) {
      let dirty = false;
      items.forEach((item, i) => {
        let pose;
        if (item.tile) {
          pose =
            tileMatrix(item.tile.id) || tileTransform(item.tile, item.model);
        } else {
          const object = item.object;
          const visual =
            object.previewIndex == null
              ? objectRoots.get(object.id)
              : objectPreview?.children[object.previewIndex];
          if (visual) {
            visual.updateMatrix();
            pose = visual.matrix;
          } else {
            pose = new Matrix4().makeRotationY(
              (-(object.rotation || 0) * Math.PI) / 180,
            );
            pose.scale(new Vector3().setScalar(object.scale || 1));
            pose.setPosition(object.x, object.elevation || 0, object.y);
          }
        }
        matrix.multiplyMatrices(pose, part.matrix);
        mesh.getMatrixAt(i, previous);
        // Instance buffers use float32; compare after quantization to avoid
        // invalidating all shadow maps every frame for a stationary scene.
        if (
          matrix.elements.every(
            (v, n) => Math.fround(v) === previous.elements[n],
          )
        )
          return;
        mesh.setMatrixAt(i, matrix);
        dirty = true;
      });
      if (dirty) {
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
        changed = true;
      }
    }
    for (const { group, visual } of legacy) {
      visual.updateMatrix();
      if (!group.matrix.equals(visual.matrix)) {
        group.matrix.copy(visual.matrix);
        changed = true;
      }
    }
    root.updateMatrixWorld(true);
    return changed;
  }
  return {
    root,
    update,
    advance,
    destroy() {
      clear();
      material.dispose();
    },
  };
}
