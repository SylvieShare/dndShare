import { DynamicDrawUsage, InstancedMesh, Matrix4 } from "three";
import { modelVisual } from "./modelVisual";
import { modelWaterMaterial } from "./modelWater";
import { applyAreaOpacity } from "./areaOpacity";
import { modelRaycast } from "./modelPicking";

const matrix = new Matrix4(),
  previous = new Matrix4();
export function writeInstances(mesh, pose, indices) {
  let first = Infinity,
    last = 0;
  for (
    let n = 0, count = indices ? indices.length : mesh.count;
    n < count;
    n++
  ) {
    const i = indices ? indices[n] : n;
    matrix.copy(pose(i)).multiply(mesh.userData.partMatrix);
    mesh.getMatrixAt(i, previous);
    if (
      matrix.elements.every((v, n) => Math.fround(v) === previous.elements[n])
    )
      continue;
    mesh.setMatrixAt(i, matrix);
    first = Math.min(first, i * 16);
    last = Math.max(last, (i + 1) * 16);
  }
  if (!Number.isFinite(first)) return false;
  const attribute = mesh.instanceMatrix;
  for (const range of attribute.updateRanges) {
    first = Math.min(first, range.start);
    last = Math.max(last, range.start + range.count);
  }
  attribute.clearUpdateRanges();
  attribute.addUpdateRange(first, last - first);
  attribute.needsUpdate = true;
  mesh.computeBoundingSphere();
  return true;
}

// Shared ownership and reconciliation for tile and prop instances. A change in
// one chunk never disposes material/instance buffers belonging to another chunk.
export function createModelBatches(root, assets, fog, kind) {
  const batches = new Map();
  function release(key, batch) {
    for (const mesh of batch.meshes) {
      root.remove(mesh);
      mesh.dispose();
      for (const material of Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material])
        material.dispose();
    }
    batches.delete(key);
  }
  function appearance(mesh, opacity, flash = 1) {
    if (mesh.userData.opacity === opacity && mesh.userData.flash === flash)
      return;
    mesh.userData.opacity = opacity;
    mesh.userData.flash = flash;
    applyAreaOpacity(mesh, opacity, flash);
  }
  return {
    sync(groups) {
      for (const [key, batch] of batches)
        if (!groups.has(key)) release(key, batch);
      for (const [key, group] of groups) {
        const source = modelVisual(assets, group.modelId, group.tier);
        const settings = assets.metadata(group.modelId)?.behaviour
          ?.waterAnimation;
        const style = JSON.stringify(settings);
        let batch = batches.get(key);
        if (
          batch &&
          (batch.source !== source ||
            batch.style !== style ||
            group.items.length > batch.capacity)
        ) {
          release(key, batch);
          batch = null;
        }
        if (!source) continue;
        if (!batch) {
          const capacity =
            2 ** Math.ceil(Math.log2(Math.max(1, group.items.length)));
          const meshes = source.parts.map((part) => {
            const materials = (
              Array.isArray(part.material) ? part.material : [part.material]
            ).map((original) => {
              const copy = fog.material(original.clone());
              copy.userData.borrowedTextures = true;
              return modelWaterMaterial(copy, part, settings);
            });
            const mesh = new InstancedMesh(
              part.geometry,
              Array.isArray(part.material) ? materials : materials[0],
              capacity,
            );
            mesh.matrixAutoUpdate = false;
            mesh.raycast = modelRaycast;
            mesh.receiveShadow = true;
            mesh.instanceMatrix.setUsage(DynamicDrawUsage);
            mesh.userData.partMatrix = part.matrix;
            root.add(mesh);
            return mesh;
          });
          batch = { source, style, capacity, meshes };
          batches.set(key, batch);
        }
        batch.group = group;
        for (const mesh of batch.meshes) {
          const resized = mesh.count !== group.items.length;
          mesh.count = group.items.length;
          mesh.userData[kind] = group.items;
          mesh.userData.indexById = new Map(
            group.items.map((item, i) => [item.id, i]),
          );
          const changed = writeInstances(mesh, (i) =>
            group.pose(group.items[i]),
          );
          if (resized && !changed) mesh.computeBoundingSphere();
          appearance(mesh, group.opacity ?? 1);
        }
      }
    },
    advance(ids) {
      let changed = false;
      for (const { meshes, group } of batches.values())
        for (const mesh of meshes) {
          const indices = ids
            ? [...ids]
                .map((id) => mesh.userData.indexById.get(id))
                .filter((i) => i !== undefined)
            : undefined;
          changed =
            writeInstances(mesh, (i) => group.pose(group.items[i]), indices) ||
            changed;
        }
      return changed;
    },
    applyAppearance(opacity, flash) {
      for (const { meshes, group } of batches.values()) {
        const id = group.items[0].id;
        for (const mesh of meshes)
          appearance(mesh, opacity(id), flash?.(id) ?? 1);
      }
    },
    destroy() {
      for (const [key, batch] of batches) release(key, batch);
    },
  };
}
