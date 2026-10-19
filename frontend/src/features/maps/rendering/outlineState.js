// The outline's solid-depth material does not use lighting, textures or shader
// clocks. Only changes that affect its rasterized geometry invalidate the cache.
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
  visit(scene);
  values.push("selected");
  for (const source of sources) {
    values.push(source.material);
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
