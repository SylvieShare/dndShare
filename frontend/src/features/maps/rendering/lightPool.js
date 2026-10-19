import { PointLight } from "three";

// Each light keeps its shadow texture when another source enters or leaves view.
export function createLightPool(scene, gpu) {
  const lights = new Map();
  function invalidate(light) {
    light.shadow.needsUpdate = true;
    gpu.shadowMap.needsUpdate = true;
  }
  function release(id, light) {
    scene.remove(light);
    light.shadow.map?.dispose();
    light.dispose();
    lights.delete(id);
  }
  return {
    invalidate,
    sync(sources) {
      const ids = new Set(sources.map((s) => s.id));
      for (const [id, light] of lights) if (!ids.has(id)) release(id, light);
      return sources.map((source) => {
        let light = lights.get(source.id);
        if (!light) {
          light = new PointLight();
          light.userData.sourceId = source.id;
          light.shadow.autoUpdate = false;
          light.shadow.mapSize.set(512, 512);
          light.shadow.bias = -0.0002;
          light.shadow.normalBias = 0.025;
          light.shadow.camera.near = 0.05;
          scene.add(light);
          lights.set(source.id, light);
        }
        return light;
      });
    },
    destroy() {
      for (const [id, light] of lights) release(id, light);
    },
  };
}
