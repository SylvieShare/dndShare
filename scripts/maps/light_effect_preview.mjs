// A static sample of the runtime fire, used only in catalogue thumbnails.
import { fireEffectGeometry } from "../../frontend/src/features/maps/rendering/fireEffectGeometry.js";
import { fireSeed } from "../../frontend/src/features/maps/rendering/fireMotion.js";
import { Color } from "../../frontend/node_modules/three/build/three.module.js";
import { createRequire } from "node:module";
const require = createRequire("/private/tmp/dndshare-model-tools/package.json"),
  { KHRMaterialsUnlit } = require("@gltf-transform/extensions");
export function addLightEffectPreview(document, model, lights) {
  const shape = fireEffectGeometry(),
    p = shape.getAttribute("position"),
    buffer = document.getRoot().listBuffers()[0],
    unlit = document.createExtension(KHRMaterialsUnlit);
  for (const light of lights) {
    const effect = light.effect;
    if (!light.enabled || effect?.kind !== "fire") continue;
    const positions = [],
      colours = [],
      colour = new Color(light.color),
      seed = fireSeed(`light-${light.key}`),
      strength = effect.strength;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i),
        z = p.getZ(i),
        phase = seed + x * 3.7 + z * 2.3,
        weight = y * y * strength;
      positions.push(
        x +
          weight *
            (0.13 * Math.sin(y * 5 + phase) + 0.05 * Math.sin(-y * 8 + phase)),
        y + weight * 0.12 * Math.sin(phase),
        z + weight * 0.1 * Math.sin(y * 6 + phase),
      );
      const t = Math.min(1, Math.max(0, y / 0.65)),
        mix = t * t * (3 - 2 * t),
        heat = 1 - 0.14 * strength + 0.14 * strength * Math.sin(y * 19 + seed);
      colours.push(
        ...[colour.r, colour.g, colour.b].map(
          (c) => ((c * 0.55 + 0.45) * (1 - mix) + c * mix) * heat,
        ),
      );
    }
    const material = document
      .createMaterial("Procedural flame preview")
      .setBaseColorFactor([1, 1, 1, 1])
      .setDoubleSided(true)
      .setExtension("KHR_materials_unlit", unlit.createUnlit());
    const primitive = document
      .createPrimitive()
      .setAttribute(
        "POSITION",
        document
          .createAccessor()
          .setType("VEC3")
          .setArray(new Float32Array(positions))
          .setBuffer(buffer),
      )
      .setAttribute(
        "COLOR_0",
        document
          .createAccessor()
          .setType("VEC3")
          .setArray(new Float32Array(colours))
          .setBuffer(buffer),
      )
      .setIndices(
        document
          .createAccessor()
          .setType("SCALAR")
          .setArray(new Uint16Array(shape.index.array))
          .setBuffer(buffer),
      )
      .setMaterial(material);
    const node = document
      .createNode("Preview flame " + light.key)
      .setMesh(document.createMesh().addPrimitive(primitive))
      .setScale([effect.size[0], effect.size[1], effect.size[0]])
      .setTranslation([
        light.position[0] + effect.offset[0] - model.width / 2,
        light.position[2] + effect.offset[2] + model.mountDepth,
        light.position[1] + effect.offset[1] - model.height / 2,
      ]);
    document.getRoot().listScenes()[0].addChild(node);
  }
  shape.dispose();
}
