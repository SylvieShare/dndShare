import { isFadingAreaSurface } from "./areaOpacity";

// Fade the nearest visible surface, not every internal triangle. Ordinary
// alpha blending cannot sort triangles within an InstancedMesh or GLB part.
export function renderAreaSurfaces(gpu, scene, camera) {
  const materials = new Map();
  let fading = false;
  scene.traverseVisible((node) => {
    for (const material of Array.isArray(node.material)
      ? node.material
      : node.material
        ? [node.material]
        : []) {
      if (!material.visible || materials.has(material)) continue;
      const surface = isFadingAreaSurface(material);
      fading ||= surface;
      materials.set(material, {
        surface,
        colorWrite: material.colorWrite,
        depthWrite: material.depthWrite,
      });
    }
  });
  if (!fading) {
    gpu.render(scene, camera);
    return;
  }
  const background = scene.background,
    autoClear = gpu.autoClear,
    shadowAutoUpdate = gpu.shadowMap.autoUpdate;
  let shadowNeedsUpdate = gpu.shadowMap.needsUpdate;
  try {
    // First keep the opaque world behind the fading surfaces in the colour
    // buffer. Transparent annotations are drawn after the surface depth pass.
    for (const material of materials.keys())
      material.visible = !material.transparent;
    gpu.render(scene, camera);
    shadowNeedsUpdate = gpu.shadowMap.needsUpdate;
    gpu.autoClear = false;
    scene.background = null;
    gpu.shadowMap.autoUpdate = false;
    gpu.shadowMap.needsUpdate = false;
    for (const [material, state] of materials) {
      material.visible = state.surface;
      if (state.surface) {
        material.colorWrite = false;
        material.depthWrite = true;
      }
    }
    // Use the original materials: their alpha cutouts and session fog discard
    // must also apply to depth. No extra geometry, targets or shadow renders.
    gpu.render(scene, camera);
    for (const [material, state] of materials) {
      material.visible = material.transparent;
      material.colorWrite = state.colorWrite;
      material.depthWrite = state.depthWrite;
    }
    gpu.render(scene, camera);
  } finally {
    for (const [material, state] of materials) {
      material.visible = true;
      material.colorWrite = state.colorWrite;
      material.depthWrite = state.depthWrite;
    }
    scene.background = background;
    gpu.autoClear = autoClear;
    gpu.shadowMap.autoUpdate = shadowAutoUpdate;
    gpu.shadowMap.needsUpdate = shadowNeedsUpdate;
  }
}
