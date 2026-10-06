import { Group, Mesh } from "three";
export function buildModelObject(object, assets, fog, tier = "render") {
  const source = assets?.model(object.modelId, tier),
    root = new Group();
  root.position.set(object.x, object.elevation || 0, object.y);
  root.scale.setScalar(object.scale);
  root.rotation.y = (-object.rotation * Math.PI) / 180;
  root.userData.objectId = object.id;
  for (const part of source?.parts || []) {
    const materials = (
      Array.isArray(part.material) ? part.material : [part.material]
    ).map((m) => {
      const copy = fog.material(m.clone());
      copy.userData.borrowedTextures = true;
      return copy;
    });
    const mesh = new Mesh(
      part.geometry,
      Array.isArray(part.material) ? materials : materials[0],
    );
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(part.matrix);
    mesh.userData.borrowedGeometry = true;
    root.add(mesh);
  }
  return root;
}
