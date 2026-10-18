import { BufferGeometry, Float32BufferAttribute } from "three";

// A shared sculptural flame: three tapered tongues, with no frame assets.
export function fireEffectGeometry() {
  const positions = [],
    indices = [],
    segments = 8,
    rings = 7;
  for (const [cx, cz, width, height, lean] of [
    [0, 0, 0.34, 1, 0.1],
    [-0.23, 0.08, 0.23, 0.76, -0.14],
    [0.2, -0.1, 0.22, 0.66, 0.18],
  ]) {
    const start = positions.length / 3;
    for (let y = 0; y <= rings; y++) {
      const t = y / rings,
        radius =
          width * Math.pow(1 - t, 0.8) * (0.72 + 0.5 * Math.sin(t * Math.PI));
      for (let a = 0; a < segments; a++) {
        const angle = (a / segments) * Math.PI * 2;
        positions.push(
          cx * (1 - t) + Math.cos(angle) * radius + lean * t * t,
          t * height,
          cz * (1 - t) + Math.sin(angle) * radius,
        );
        if (y < rings) {
          const i = start + y * segments + a,
            next = start + y * segments + ((a + 1) % segments);
          indices.push(
            i,
            next,
            i + segments,
            next,
            next + segments,
            i + segments,
          );
        }
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function fireEffectMaterial(material, seed) {
  const uniforms = {
      effectClock: { value: 0 },
      effectStrength: { value: 0.7 },
      effectSeed: { value: seed },
    },
    before = material.onBeforeCompile,
    programKey = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    before.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    const declarations = `uniform float effectClock; uniform float effectStrength;
uniform float effectSeed; varying float fireHeight;`;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${declarations}`)
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
fireHeight = position.y;
float phase = effectSeed + position.x * 3.7 + position.z * 2.3;
float weight = position.y * position.y * effectStrength;
transformed.x += weight * (0.13 * sin(effectClock * 7.3 + position.y * 5.0 + phase)
  + 0.05 * sin(effectClock * 13.1 - position.y * 8.0 + phase));
transformed.z += weight * 0.10 * sin(effectClock * 8.7 + position.y * 6.0 + phase);
transformed.y += weight * 0.12 * sin(effectClock * 9.1 + phase);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${declarations}`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
float heat = 0.86 + 0.14 * sin(fireHeight * 19.0 - effectClock * 11.0 + effectSeed);
diffuseColor.rgb = mix(vec3(1.0, 0.95, 0.65), diffuseColor.rgb,
  smoothstep(0.0, 0.65, fireHeight)) * heat;`,
      );
  };
  material.customProgramCacheKey = () => `${programKey}:procedural-fire-v1`;
  return uniforms;
}
