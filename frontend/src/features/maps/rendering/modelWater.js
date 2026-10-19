import { Vector2, Frustum, Matrix4 } from "three";
import { reducedMapMotion } from "./scalarMotion";

export const WATER_FPS = 12;
const bindings = new WeakMap();
const patterns = { pool: 0, surface: 1, vortex: 2 };
function configure(uniforms, settings) {
  const pattern = patterns[settings.pattern || "pool"];
  uniforms.waterPattern.value = pattern;
  uniforms.waterWorldSpace.value = pattern === 1 ? 1 : 0;
  uniforms.waterCenter.value.fromArray(settings.center || [0, 0]);
  uniforms.waterRoughnessMax.value = settings.roughnessMax || 0.5;
  uniforms.waterStrength.value = settings.enabled ? settings.strength : 0;
}

// Painted PBR channels identify liquid at fragment precision. A measured vertex
// mask, when supplied by the model, further restricts coverage and falling flow.
export function modelWaterMaterial(material, part, settings) {
  if (!settings || !material.isMeshStandardMaterial) return material;
  if (bindings.has(material)) {
    bindings.get(material).settings = settings;
    return material;
  }
  if (
    (!material.roughnessMap &&
      material.roughness >= (settings.roughnessMax || 0.5)) ||
    (!material.metalnessMap && material.metalness >= 0.15)
  )
    return material;
  const measured = part.geometry.hasAttribute("_water");
  const uniforms = {
    waterClock: { value: 0 },
    waterStrength: { value: 0 },
    waterMatrix: { value: part.matrix },
    waterPattern: { value: 0 },
    waterWorldSpace: { value: 0 },
    waterCenter: { value: new Vector2() },
    waterRoughnessMax: { value: 0.5 },
  };
  configure(uniforms, settings);
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
${measured ? "attribute vec2 _water;" : ""}
uniform mat4 waterMatrix; uniform float waterWorldSpace;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vec4 waterWorld = vec4(position, 1.0);
#ifdef USE_INSTANCING
waterWorld = instanceMatrix * waterWorld;
#endif
waterWorld = modelMatrix * waterWorld;
waterPosition = mix((waterMatrix * vec4(position, 1.0)).xyz, waterWorld.xyz, waterWorldSpace);
waterMask = ${measured ? "_water" : "vec2(1.0, -1.0)"};`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>\n${varying}
uniform float waterClock; uniform float waterStrength;
uniform float waterPattern; uniform float waterRoughnessMax; uniform vec2 waterCenter;
float waterWave(vec3 p, float falling) {
  vec2 local = p.xz - waterCenter;
  float radius = length(local);
  float ripple = sin(radius * 37.0 - waterClock * 3.2)
    + 0.35 * sin(local.x * 24.0 + local.y * 19.0 - waterClock * 2.1);
  if (waterPattern > 0.5 && waterPattern < 1.5)
    ripple = sin(dot(p.xz, vec2(24.0, 17.0)) - waterClock * 3.2)
      + 0.35 * sin(dot(p.xz, vec2(-17.0, 28.0)) - waterClock * 2.1);
  if (waterPattern > 1.5)
    return sin(atan(local.y, local.x + 0.00001) * 4.0 + radius * 37.0 + waterClock * 4.2);
  float flow = sin(p.y * 58.0 + waterClock * 11.0
    + 1.7 * sin(p.x * 31.0 + p.z * 29.0));
  return mix(ripple * 0.74, flow, falling);
}`,
      )
      .replace(
        "#include <metalnessmap_fragment>",
        `#include <metalnessmap_fragment>
float waterCoverage = waterMask.x
  * (1.0 - smoothstep(max(0.0, waterRoughnessMax - 0.03), waterRoughnessMax, roughnessFactor))
  * (1.0 - smoothstep(0.05, 0.15, metalnessFactor));
vec3 waterSurface = cross(dFdx(waterPosition), dFdy(waterPosition));
float waterUp = abs(waterSurface.y) / max(length(waterSurface), 1e-10);
float waterFalling = waterMask.y < 0.0
  ? 1.0 - smoothstep(0.12, 0.45, waterUp) : waterMask.y;
float waterAmount = waterCoverage * waterStrength;
float waterSignal = waterWave(waterPosition, waterFalling);
diffuseColor.rgb *= 1.0 + waterAmount * waterSignal * 0.13;
diffuseColor.rgb += (diffuseColor.rgb + vec3(0.08)) * 0.10 * waterAmount
  * smoothstep(0.72, 1.0, waterSignal);`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
float waterHeight = waterSignal * waterAmount * 0.003;
vec3 waterQ0 = dFdx(-vViewPosition), waterQ1 = dFdy(-vViewPosition);
vec3 waterR1 = cross(waterQ1, normal), waterR2 = cross(normal, waterQ0);
float waterDet = dot(waterQ0, waterR1);
vec3 waterGradient = waterCoverage * (dFdx(waterHeight) * waterR1 + dFdy(waterHeight) * waterR2);
normal = normalize(max(abs(waterDet), 1e-10) * normal - sign(waterDet) * waterGradient);`,
      );
  };
  material.customProgramCacheKey = () => `${key}:model-water-v2:${measured}`;
  material.needsUpdate = true;
  return material;
}

export function createModelWaterAnimation() {
  let entries = [];
  const frustum = new Frustum(),
    projection = new Matrix4();
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
    advance(time, animate = true, camera) {
      let active = false;
      const immediate = !animate || reducedMapMotion();
      if (camera) {
        camera.updateMatrixWorld(true);
        frustum.setFromProjectionMatrix(
          projection.multiplyMatrices(
            camera.projectionMatrix,
            camera.matrixWorldInverse,
          ),
        );
      }
      for (const { node, uniforms, settings } of entries) {
        configure(uniforms, settings);
        let visible = true;
        for (let parent = node; parent; parent = parent.parent)
          visible &&= parent.visible;
        if (visible && camera && node.frustumCulled) {
          node.updateWorldMatrix(true, false);
          visible = frustum.intersectsObject(node);
        }
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
