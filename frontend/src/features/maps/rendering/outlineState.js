import { Sphere, Vector3 } from "three";

const sphere = new Sphere(),
  center = new Vector3();

// Shader-deformed occluders matter only when they overlap the selected region.
// Ordinary light flicker and distant flames keep the cached contour intact.
export function dynamicOutlineState(nodes, region, camera, width, height) {
  const values = [];
  if (!region) return values;
  for (const node of nodes) {
    if (!node.visible) continue;
    if (!node.geometry.boundingSphere) node.geometry.computeBoundingSphere();
    sphere.copy(node.geometry.boundingSphere).applyMatrix4(node.matrixWorld);
    center.copy(sphere.center).project(camera);
    const x = ((center.x + 1) * width) / 2,
      y = ((center.y + 1) * height) / 2;
    const rx =
      (sphere.radius * Math.abs(camera.projectionMatrix.elements[0]) * width) /
      2;
    const ry =
      (sphere.radius * Math.abs(camera.projectionMatrix.elements[5]) * height) /
      2;
    if (
      x + rx < region.x ||
      y + ry < region.y ||
      x - rx > region.x + region.width ||
      y - ry > region.y + region.height
    )
      continue;
    values.push(node.id, node.userData.outlineClock);
  }
  return values;
}

// Geometry and depth-writing shader deformations invalidate the contour;
// lighting and colour changes keep the cached result intact.
function geometryState(out, mesh, instances) {
  const geometry = mesh.geometry,
    position = geometry?.attributes.position,
    index = geometry?.index;
  out.push(
    mesh,
    geometry,
    position,
    position?.version,
    position?.data?.version,
    index,
    index?.version,
    geometry?.drawRange.start,
    geometry?.drawRange.count,
    mesh.count,
    mesh.layers.mask,
    mesh.frustumCulled,
  );
  out.push(...mesh.matrixWorld.elements);
  for (const group of geometry?.groups || [])
    out.push(group.start, group.count, group.materialIndex);
  out.push(null);
  if (mesh.instanceMatrix) {
    out.push(mesh.instanceMatrix);
    if (instances) {
      const values = mesh.instanceMatrix.array,
        count = mesh.count * 16;
      for (let i = 0; i < count; i++) out.push(values[i]);
    } else out.push(mesh.instanceMatrix.version);
  }
  if (mesh.morphTargetInfluences) out.push(...mesh.morphTargetInfluences);
  if (mesh.skeleton?.boneMatrices) out.push(...mesh.skeleton.boneMatrices);
}
export function outlineState(
  scene,
  camera,
  sources,
  ignored,
  revision,
  width,
  height,
  ratio,
  colours,
) {
  const values = [
    revision,
    width,
    height,
    ratio,
    camera,
    camera.layers.mask,
    ...camera.projectionMatrix.elements,
    ...camera.matrixWorldInverse.elements,
    ...colours,
  ];
  function visit(node) {
    if (!node.visible || ignored.has(node)) return;
    if (node.isMesh || node.isLine || node.isPoints || node.isSprite) {
      geometryState(values, node, false);
      const materials = Array.isArray(node.material)
        ? node.material
        : [node.material];
      values.push(materials.length, ...materials.map((m) => m?.visible));
    }
    for (const child of node.children) visit(child);
  }
  if (scene.userData.outlineRevision === undefined) visit(scene);
  else values.push(scene.userData.outlineRevision);
  values.push("selected");
  for (const source of sources) {
    values.push(source.material);
    if (source.material.map)
      values.push(
        source.material.map,
        source.material.map.version,
        source.material.opacity,
        source.material.alphaTest,
        ...source.material.color.toArray(),
      );
    geometryState(values, source.mesh, true);
  }
  return values;
}
export function sameOutlineState(previous, next) {
  return (
    previous?.length === next.length &&
    next.every((value, i) => value === previous[i])
  );
}
