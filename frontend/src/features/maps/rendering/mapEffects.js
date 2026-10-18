import {
  Group,
  Mesh,
  MeshBasicMaterial,
  DoubleSide,
  Vector3,
  SphereGeometry,
} from "three";
import { createScalarMotion, reducedMapMotion } from "./scalarMotion";
import { createAttachedLights } from "./attachedLights";
import { applyAreaOpacity } from "./areaOpacity";
import { fireEffectGeometry, fireEffectMaterial } from "./fireEffectGeometry";
import {
  componentEnabled,
  effectPose,
  effectOpacity,
} from "../lib/mapComponents";

export const FIRE_FPS = 12;
const seed = (id) =>
  [...id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) | 0, 0) % 1000;

export function createMapEffects(scene, fog, assets, changed = () => {}) {
  const root = new Group(),
    geometry = fireEffectGeometry(),
    entries = new Map(),
    markerGeometry = new SphereGeometry(0.045, 12, 8),
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
    root.remove(entry.marker);
    entry.mesh.material.dispose();
    entry.marker.material.dispose();
    entries.delete(id);
  }
  return {
    root,
    update(document, options, context, placed, objects, nextAppearance) {
      appearance = nextAppearance;
      animate = options.animate !== false;
      const catalogue = assets.catalogue?.() || [];
      sources = [
        ...(document.effects || []).filter(
          (e) => e.id !== options.previewEffect?.id,
        ),
        ...(options.previewEffect ? [options.previewEffect] : []),
      ].map((e) => ({
        ...effectPose(e, document, catalogue, context),
        enabled: componentEnabled(document, e),
        opacity: effectOpacity(e, document, options.areaMode),
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
            uniforms = fireEffectMaterial(material, seed(source.id)),
            marker = new Mesh(
              markerGeometry,
              new MeshBasicMaterial({ color: 0x4f9cf9, toneMapped: false }),
            );
          mesh.userData.effectId = source.id;
          marker.userData.effectId = source.id;
          mesh.frustumCulled = false;
          root.add(mesh, marker);
          entry = { mesh, uniforms, marker };
          entries.set(source.id, entry);
        }
        entry.mesh.material.color.set(source.color);
        entry.mesh.position.set(source.x, source.worldHeight, source.y);
        entry.marker.position.set(
          source.x,
          source.worldHeight + source.size[1] / 2,
          source.y,
        );
        entry.marker.visible =
          !!options.master &&
          !!options.editLights &&
          options.selectedEffect === source.id &&
          source.opacity > 0.001;
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
        const { mesh, uniforms, marker } = entries.get(source.id),
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
        marker.position.copy(mesh.position);
        marker.position.y += source.size[1] / 2;
        applyAreaOpacity(mesh, opacity);
        uniforms.effectClock.value = immediate
          ? 0
          : Math.floor((time * FIRE_FPS) / 1000) / FIRE_FPS;
        if (opacity > 0.001 && !immediate)
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
        [...entries.values()]
          .flatMap((e) => [e.mesh, e.marker])
          .filter((m) => m.visible),
        false,
      )[0];
      return (
        hit && {
          effectId: hit.object.userData.effectId,
          distance: hit.distance,
        }
      );
    },
    position(id) {
      return entries.get(id)?.mesh.position.clone() || new Vector3();
    },
    destroy() {
      for (const id of [...entries.keys()]) remove(id);
      motion.clear();
      geometry.dispose();
      markerGeometry.dispose();
      root.removeFromParent();
    },
  };
}
