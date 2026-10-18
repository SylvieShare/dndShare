import { reducedMapMotion } from "./scalarMotion";

export const WATER_FPS = 12;
const bindings = new WeakMap();

// _WATER is a measured two-channel mask, never an atlas colour guess.
export function modelWaterMaterial(material, part, settings) {
  if (!settings || !part.geometry.hasAttribute("_water")) return material;
  if (bindings.has(material)) {
    bindings.get(material).settings = settings;
    return material;
  }
  const uniforms = {
    waterClock: { value: 0 },
    waterStrength: { value: settings.enabled ? settings.strength : 0 },
    waterMatrix: { value: part.matrix },
  };
  bindings.set(material, { uniforms, settings });
  const before = material.onBeforeCompile,
    key = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    before.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    const varying = "varying vec3 waterPosition; varying vec2 waterMask;";
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>\n${varying}
attribute vec2 _water; uniform mat4 waterMatrix;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
waterPosition = (waterMatrix * vec4(position, 1.0)).xyz;
waterMask = _water;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>\n${varying}
uniform float waterClock; uniform float waterStrength;
float waterWave(vec3 p) {
  float radius = length(p.xz);
  float ripple = sin(radius * 37.0 - waterClock * 3.2)
    + 0.35 * sin(p.x * 24.0 + p.z * 19.0 - waterClock * 2.1);
  // Increasing phase with time makes constant-height bands travel downwards.
  float flow = sin(p.y * 58.0 + waterClock * 11.0
    + 1.7 * sin(p.x * 31.0 + p.z * 29.0));
  return mix(ripple * 0.74, flow, waterMask.y);
}`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
float waterAmount = waterMask.x * waterStrength;
float waterSignal = waterWave(waterPosition);
diffuseColor.rgb *= 1.0 + waterAmount * waterSignal * 0.13;
diffuseColor.rgb += vec3(0.018, 0.026, 0.028) * waterAmount
  * smoothstep(0.72, 1.0, waterSignal);`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
// Perturb the lit normal without moving the rim or shadow geometry.
float waterHeight = waterSignal * waterAmount * 0.003;
vec3 waterQ0 = dFdx(-vViewPosition), waterQ1 = dFdy(-vViewPosition);
vec3 waterR1 = cross(waterQ1, normal), waterR2 = cross(normal, waterQ0);
float waterDet = dot(waterQ0, waterR1);
vec3 waterGradient = waterMask.x * (dFdx(waterHeight) * waterR1 + dFdy(waterHeight) * waterR2);
normal = normalize(max(abs(waterDet), 1e-10) * normal - sign(waterDet) * waterGradient);`,
      );
  };
  material.customProgramCacheKey = () => `${key}:model-water-v1`;
  return material;
}

export function createModelWaterAnimation() {
  let entries = [];
  return {
    update(roots) {
      entries = [];
      for (const root of roots)
        root.traverse((node) => {
          for (const material of Array.isArray(node.material)
            ? node.material
            : node.material
              ? [node.material]
              : []) {
            const binding = bindings.get(material);
            if (binding) entries.push({ node, ...binding });
          }
        });
    },
    advance(time, animate = true) {
      let active = false;
      const immediate = !animate || reducedMapMotion();
      for (const { node, uniforms, settings } of entries) {
        uniforms.waterStrength.value = settings.enabled ? settings.strength : 0;
        let visible = true;
        for (let parent = node; parent; parent = parent.parent)
          visible &&= parent.visible;
        const moving =
          !immediate &&
          settings.enabled &&
          settings.speed > 0 &&
          settings.strength > 0;
        uniforms.waterClock.value = moving
          ? (Math.floor((time * WATER_FPS) / 1000) / WATER_FPS) * settings.speed
          : 0;
        active ||= visible && moving;
      }
      return active
        ? Math.max(
            0,
            ((Math.floor((time * WATER_FPS) / 1000) + 1) * 1000) / WATER_FPS -
              time -
              1000 / 60,
          )
        : Infinity;
    },
  };
}
