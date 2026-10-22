import { modelVisual } from "./modelVisual";
import {
  Group,
  DoubleSide,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Scene,
} from "three";
import { tileTransform } from "./tileTransform";
import { createOutlinePasses } from "./outlinePasses";

export function createTileOutline(gpu, assets) {
  const maskScene = new Scene(),
    root = new Group(),
    motion = new Group();
  maskScene.userData.renderCategory = "outline";
  maskScene.add(root, motion);
  const hover = new MeshBasicMaterial({
    color: 0xff0000,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    depthWrite: false,
    side: DoubleSide,
  });
  const selected = new MeshBasicMaterial({
    color: 0x00ff00,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    depthWrite: false,
    side: DoubleSide,
  });
  const invalid = new MeshBasicMaterial({
    color: 0xffffff,
    toneMapped: false,
    depthWrite: false,
    side: DoubleSide,
  });
  const objectHover = hover.clone();
  objectHover.color.setRGB(0, 0, 0.55);
  const objectSelected = selected.clone();
  objectSelected.color.setHex(0x0000ff);
  const passes = createOutlinePasses(gpu),
    nextMatrix = new Matrix4(),
    oldMatrix = new Matrix4();
  let key = "",
    motionKey = "",
    revision = 0;
  function clear() {
    root.children.forEach((mesh) => mesh.dispose?.());
    root.clear();
  }
  function update(document, options, tier) {
    passes.colour(options.selectionColor);
    const selection = new Set(options.selectedTiles || [options.selectedTile]);
    const hidden = new Set(options.previewTile?.tileIds || []);
    const tiles = document.tiles
      .filter(
        (tile) =>
          options.master &&
          !hidden.has(tile.id) &&
          (selection.has(tile.id) || tile.id === options.hoveredTile),
      )
      .map((tile) => [tile, selection.has(tile.id) ? selected : hover]);
    if (options.previewTile?.wallBrush && options.master)
      tiles.push(...options.previewTile.group.map((tile) => [tile, hover]));
    const nextKey = JSON.stringify([
      assets.signature?.(new Set(document.tiles.map((t) => t.modelId)), tier),
      tiles.map(([tile, material]) => [tile, material === selected]),
      tier,
    ]);
    if (key === nextKey) return;
    key = nextKey;
    revision++;
    clear();
    const buckets = new Map();
    for (const [tile, material] of tiles) {
      const bucket = `${tile.modelId}:${material === selected}`;
      if (!buckets.has(bucket)) buckets.set(bucket, []);
      buckets.get(bucket).push([tile, material]);
    }
    for (const entries of buckets.values()) {
      const [first, material] = entries[0],
        model = modelVisual(assets, first.modelId, tier),
        metadata = assets.metadata(first.modelId);
      if (!model || !metadata) continue;
      for (const part of model.parts) {
        const mesh = new InstancedMesh(part.geometry, material, entries.length);
        mesh.userData = { entries, metadata, partMatrix: part.matrix };
        entries.forEach(([tile], index) =>
          mesh.setMatrixAt(
            index,
            new Matrix4().multiplyMatrices(
              tileTransform(tile, metadata),
              part.matrix,
            ),
          ),
        );
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
        root.add(mesh);
      }
    }
  }
  function sourcesFor(previews) {
    const source = [];
    for (const preview of previews)
      if (preview.visible) {
        preview.updateMatrixWorld(true);
        preview.traverse((mesh) => {
          if (mesh.isMesh)
            source.push({
              mesh,
              material:
                mesh.userData.outlineMaterial ||
                (preview.userData.outlineStyle === "invalid"
                  ? invalid
                  : preview.userData.outlineType === "object"
                    ? preview.userData.outlineStyle === "hover"
                      ? objectHover
                      : objectSelected
                    : preview.userData.outlineStyle === "hover"
                      ? hover
                      : selected),
            });
        });
      }
    return source;
  }
  function syncMotion(source) {
    const next = source
      .map(
        ({ mesh, material }) =>
          `${mesh.id}:${mesh.geometry.id}:${mesh.count || 0}:${material.id}`,
      )
      .join(",");
    if (next !== motionKey) {
      motion.children.forEach((mesh) => mesh.dispose?.());
      motion.clear();
      motionKey = next;
      for (const { mesh, material } of source) {
        const copy = mesh.isInstancedMesh
          ? new InstancedMesh(mesh.geometry, material, mesh.count)
          : new Mesh(mesh.geometry, material);
        copy.matrixAutoUpdate = false;
        copy.frustumCulled = false;
        motion.add(copy);
      }
    }
    source.forEach(({ mesh }, i) => {
      const copy = motion.children[i];
      copy.matrix.copy(mesh.matrixWorld);
      if (mesh.isInstancedMesh) {
        copy.instanceMatrix.array.set(mesh.instanceMatrix.array);
        copy.instanceMatrix.needsUpdate = true;
      }
    });
  }
  function render(
    scene,
    camera,
    annotations,
    previews,
    tileMatrix,
    excluded = [],
    frameDepth,
    animated = [],
  ) {
    const sources = sourcesFor(previews);
    if (!root.children.length && !sources.length) {
      syncMotion([]);
      passes.invalidate();
      return;
    }
    passes.render(
      scene,
      camera,
      annotations,
      previews,
      excluded,
      maskScene,
      sources,
      revision,
      () => {
        if (tileMatrix)
          for (const mesh of root.children) {
            let changed = false;
            const { entries, metadata, partMatrix } = mesh.userData;
            entries.forEach(([tile], i) => {
              nextMatrix.multiplyMatrices(
                tileMatrix(tile.id) || tileTransform(tile, metadata),
                partMatrix,
              );
              mesh.getMatrixAt(i, oldMatrix);
              if (!oldMatrix.equals(nextMatrix)) {
                mesh.setMatrixAt(i, nextMatrix);
                changed = true;
              }
            });
            if (changed) {
              mesh.instanceMatrix.needsUpdate = true;
              mesh.computeBoundingSphere();
            }
          }
        syncMotion(sources);
      },
      frameDepth,
      animated,
    );
  }

  function destroy() {
    clear();
    motion.children.forEach((mesh) => mesh.dispose?.());
    motion.clear();
    passes.destroy();
    invalid.dispose();
    hover.dispose();
    selected.dispose();
    objectHover.dispose();
    objectSelected.dispose();
  }
  return { update, render, destroy };
}
