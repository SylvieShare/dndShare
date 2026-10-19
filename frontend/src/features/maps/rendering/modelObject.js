import { modelVisual } from "./modelVisual";
import { Group, Mesh } from "three";
import { modelWaterMaterial } from "./modelWater";
import { modelRaycast } from "./modelPicking";
export function buildModelObject(object, assets, fog, tier = "render") {
  const source = modelVisual(assets, object.modelId, tier),
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
      return modelWaterMaterial(
        copy,
        part,
        assets.metadata?.(object.modelId)?.behaviour?.waterAnimation,
      );
    });
    const mesh = new Mesh(
      part.geometry,
      Array.isArray(part.material) ? materials : materials[0],
    );
    mesh.matrixAutoUpdate = false;
    mesh.raycast = modelRaycast;
    mesh.receiveShadow = true;
    mesh.matrix.copy(part.matrix);
    mesh.userData.borrowedGeometry = true;
    root.add(mesh);
  }
  return root;
}
