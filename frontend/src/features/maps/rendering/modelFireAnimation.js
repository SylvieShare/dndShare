import { hasModelFire, modelFireFPS } from "../lib/modelFire";
import { reducedMapMotion } from "./scalarMotion";
import { modelFireShader } from "./modelFireShader";

function visible(mesh, scene) {
  for (let node = mesh; node; node = node.parent) {
    if (!node.visible) return false;
    if (node.isScene) return !scene || node === scene;
  }
  return false;
}

function phase(mesh) {
  const key = mesh.userData.tiles?.[0]?.id || mesh.uuid;
  let hash = 0;
  for (const c of key) hash = (hash * 31 + c.charCodeAt(0)) | 0;
  return (Math.abs(hash) % 10000) / 1000;
}

export function createModelFireAnimation(metadata) {
  const entries = new Set();
  return {
    // Materials must belong to this mesh, while geometry/textures stay shared.
    prepare(mesh, id, frame) {
      const model = metadata(id);
      if (!hasModelFire(model)) return;
      for (const material of Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material]) {
        if (!material.emissiveMap) continue;
        if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
        const top = mesh.geometry.boundingBox.clone().applyMatrix4(frame).max.y;
        const uniforms = modelFireShader(material, frame, top, phase(mesh));
        const entry = { mesh, material, uniforms, id };
        const release = () => {
          entries.delete(entry);
          material.removeEventListener("dispose", release);
        };
        entry.release = release;
        material.addEventListener("dispose", release);
        entries.add(entry);
      }
    },
    // Quantize flame time only. Camera/placement and the light keep their own
    // clocks. Wake one refresh before the deadline: the caller still waits for
    // requestAnimationFrame, including at 60 FPS on an otherwise idle map.
    advance(time, animate = true, override, scene) {
      const enabled = animate && !reducedMapMotion();
      let delay = Infinity;
      for (const { mesh, material, uniforms, id } of entries) {
        uniforms.modelFireMotion.value = enabled ? 1 : 0;
        if (!visible(mesh, scene) || material.opacity <= 0.001) continue;
        const fps = modelFireFPS(override || metadata(id)),
          tick = Math.floor((time * fps) / 1000);
        uniforms.modelFireTime.value = enabled ? tick / fps : 0;
        if (enabled) delay = Math.min(delay, ((tick + 1) * 1000) / fps - time);
      }
      return Math.max(0, delay - 1000 / 60);
    },
    destroy() {
      for (const entry of [...entries]) entry.release();
    },
  };
}
