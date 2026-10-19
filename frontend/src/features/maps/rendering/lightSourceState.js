import { lightPose, lightOpacity } from "../lib/mapLighting";
import { lightEffectPose } from "../lib/lightEffect";
import { fogAreaMembers } from "../lib/mapAreas";
import { createAttachedLights } from "./attachedLights";
import { fireMotion, FIRE_FPS } from "./fireMotion";
import { documentIndex } from "../lib/documentIndex";

export function createLightSourceState(assets) {
  let lights = [],
    flames = [],
    lastFrame,
    roots,
    frameKey;
  const matrices = new Map(),
    samples = new Map();
  const frames = {
    matrix(anchor, tileMatrix, objects, preview) {
      const key = `${anchor.kind}:${anchor.id}`;
      if (matrices.has(key)) return matrices.get(key);
      let matrix;
      if (anchor.kind === "tile") matrix = tileMatrix(anchor.id);
      else {
        if (!roots)
          roots = new Map(
            [...objects.children, ...(preview?.children || [])]
              .filter((n) => n.userData.objectId)
              .map((n) => [n.userData.objectId, n]),
          );
        const node = roots.get(anchor.id);
        node?.updateMatrix();
        matrix = node?.matrix;
      }
      matrices.set(key, matrix);
      return matrix;
    },
  };
  const lightBindings = createAttachedLights(frames),
    flameBindings = createAttachedLights(frames);
  function begin(time) {
    if (lastFrame === time) return;
    lastFrame = time;
    roots = null;
    matrices.clear();
  }
  return {
    get lights() {
      return lights;
    },
    get flames() {
      return flames;
    },
    update(document, options, context, placed, objects) {
      const catalogue = assets.catalogue?.() || [],
        mist = fogAreaMembers(document);
      const sources = [
        ...(document.lights || []).filter(
          (l) => l.id !== options.previewLight?.id,
        ),
        ...(options.previewLight ? [options.previewLight] : []),
      ];
      lights = [];
      flames = [];
      lastFrame = frameKey = undefined;
      roots = null;
      matrices.clear();
      samples.clear();
      if (!sources.length) {
        lightBindings.update([], [], [], []);
        flameBindings.update([], [], [], []);
        return;
      }
      context = documentIndex(document, catalogue, context).structure;
      for (const source of sources) {
        const pose = lightPose(source, document, catalogue, context);
        const opacity = lightOpacity(
          source,
          document,
          options.areaMode,
          mist,
          context,
        );
        lights.push({
          ...pose,
          worldHeight: pose.worldHeight + (source.moving ? 0.22 : 0),
          opacity,
        });
        if (source.effect?.kind === "fire")
          flames.push({ ...lightEffectPose(source, document, pose), opacity });
      }
      lightBindings.update(lights, placed, objects, catalogue);
      flameBindings.update(flames, placed, objects, catalogue);
      lastFrame = frameKey = undefined;
      samples.clear();
    },
    position(source, effect, time, tileMatrix, objects, preview) {
      begin(time);
      return (effect ? flameBindings : lightBindings).position(
        source,
        tileMatrix,
        objects,
        preview,
      );
    },
    fire(source, time, stationary) {
      const key = Math.floor((time * FIRE_FPS) / 1000);
      if (frameKey !== key) {
        frameKey = key;
        samples.clear();
      }
      const sample = `${source.id}:${stationary}`;
      if (!samples.has(sample))
        samples.set(sample, fireMotion(source, time, stationary));
      return samples.get(sample);
    },
  };
}
