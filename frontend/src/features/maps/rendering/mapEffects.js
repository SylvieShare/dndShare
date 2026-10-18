import { Group, Mesh, MeshBasicMaterial, DoubleSide } from "three";
import { createScalarMotion, reducedMapMotion } from "./scalarMotion";
import { createAttachedLights } from "./attachedLights";
import { applyAreaOpacity } from "./areaOpacity";
import { fireEffectGeometry, fireEffectMaterial } from "./fireEffectGeometry";
import { lightEffectPose } from "../lib/lightEffect";
import { lightPose, lightOpacity } from "../lib/mapLighting";
import { FIRE_FPS, fireClock, fireSeed } from "./fireMotion";
export { FIRE_FPS } from "./fireMotion";

export function createMapEffects(scene, fog, assets, changed = () => {}) {
  const root = new Group(),
    geometry = fireEffectGeometry(),
    entries = new Map(),
    motion = createScalarMotion(),
    attachments = createAttachedLights();
  scene.add(root);
  let sources = [],
    appearance,
    animate = true;
  function remove(id) {
    const entry = entries.get(id);
    if (!entry) return;
    root.remove(entry.mesh);
    entry.mesh.material.dispose();
    entries.delete(id);
  }
  return {
    root,
    update(document, options, context, placed, objects, nextAppearance) {
      appearance = nextAppearance;
      animate = options.animate !== false;
      const catalogue = assets.catalogue?.() || [];
      sources = [
        ...(document.lights || []).filter(
          (l) => l.id !== options.previewLight?.id,
        ),
        ...(options.previewLight ? [options.previewLight] : []),
      ]
        .filter((l) => l.effect?.kind === "fire")
        .map((l) => ({
          ...lightEffectPose(
            l,
            document,
            lightPose(l, document, catalogue, context),
          ),
          opacity: lightOpacity(l, document, options.areaMode),
        }));
      const ids = new Set(sources.map((e) => e.id));
      for (const id of entries.keys()) if (!ids.has(id)) remove(id);
      motion.retain(ids);
      attachments.update(sources, placed, objects, catalogue);
      for (const source of sources) {
        let entry = entries.get(source.id);
        if (!entry) {
          const material = fog.material(
              new MeshBasicMaterial({
                color: source.color,
                side: DoubleSide,
                toneMapped: false,
              }),
            ),
            mesh = new Mesh(geometry, material),
            uniforms = fireEffectMaterial(material, fireSeed(source.id));
          mesh.userData.lightId = source.id;
          mesh.frustumCulled = false;
          root.add(mesh);
          entry = { mesh, uniforms };
          entries.set(source.id, entry);
        }
        entry.mesh.material.color.set(source.color);
        entry.mesh.position.set(source.x, source.worldHeight, source.y);
        entry.mesh.scale.set(source.size[0], source.size[1], source.size[0]);
        entry.uniforms.effectStrength.value = source.strength;
        motion.set(source.id, source.enabled ? 1 : 0, {
          duration: 260,
          initial: source.enabled ? 1 : 0,
          immediate: !animate || reducedMapMotion(),
        });
      }
      changed();
    },
    advance(time, delta, tileMatrix, objects, objectPreview) {
      const immediate = !animate || reducedMapMotion(),
        moving = motion.advance(delta, immediate);
      let delay = Infinity;
      for (const source of sources) {
        const { mesh, uniforms } = entries.get(source.id),
          position = attachments.position(
            source,
            tileMatrix,
            objects,
            objectPreview,
          ),
          opacity =
            (appearance?.lightOpacity(source) ?? source.opacity) *
            motion.value(source.id);
        if (position) mesh.position.copy(position);
        applyAreaOpacity(mesh, opacity);
        uniforms.effectClock.value =
          immediate || !source.strength ? 0 : fireClock(time);
        if (opacity > 0.001 && !immediate && source.strength > 0)
          delay = Math.min(
            delay,
            ((Math.floor((time * FIRE_FPS) / 1000) + 1) * 1000) / FIRE_FPS -
              time,
          );
      }
      return { moving, delay: Math.max(0, delay - 1000 / 60) };
    },
    pick(ray) {
      const hit = ray.intersectObjects(
        [...entries.values()].map((e) => e.mesh).filter((m) => m.visible),
        false,
      )[0];
      return (
        hit && {
          lightId: hit.object.userData.lightId,
          distance: hit.distance,
        }
      );
    },
    destroy() {
      for (const id of [...entries.keys()]) remove(id);
      motion.clear();
      geometry.dispose();
      root.removeFromParent();
    },
  };
}
