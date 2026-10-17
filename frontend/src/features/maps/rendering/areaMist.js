import { MeshBasicMaterial } from "three";

// An opaque, unlit mist coats the tile silhouette without revealing its texture.
// Shared time uniform keeps every instance moving without per-tile draw passes.
export function createAreaMist() {
  const time = { value: 0 };
  let active = false;
  return {
    setActive(value) {
      active = value;
    },
    advance(delta) {
      time.value += delta / 1000;
      return active;
    },
    material() {
      const material = new MeshBasicMaterial({ color: 0xffffff });
      material.onBeforeCompile = (shader) => {
        shader.uniforms.mistTime = time;
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            "#include <common>\nvarying vec3 mistPosition;",
          )
          .replace(
            "#include <project_vertex>",
            `#include <project_vertex>
          vec4 mistWorld = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
          mistWorld = instanceMatrix * mistWorld;
          #endif
          mistPosition = (modelMatrix * mistWorld).xyz;`,
          );
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <common>",
            `#include <common>
          uniform float mistTime; varying vec3 mistPosition;
          float mistHash(vec3 p) { return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
          float mistNoise(vec3 p) {
            vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
            return mix(mix(mix(mistHash(i),mistHash(i+vec3(1,0,0)),f.x),mix(mistHash(i+vec3(0,1,0)),mistHash(i+vec3(1,1,0)),f.x),f.y),
              mix(mix(mistHash(i+vec3(0,0,1)),mistHash(i+vec3(1,0,1)),f.x),mix(mistHash(i+vec3(0,1,1)),mistHash(i+vec3(1,1,1)),f.x),f.y),f.z);
          }`,
          )
          .replace(
            "#include <opaque_fragment>",
            `
          vec3 p = mistPosition * 2.0 + vec3(mistTime * 0.08, 0.0, mistTime * 0.035);
          float cloud = mistNoise(p) * 0.7 + mistNoise(p * 2.7) * 0.3;
          outgoingLight = mix(vec3(0.045,0.06,0.085),vec3(0.32,0.37,0.43), smoothstep(0.15,0.9,cloud));
          #include <opaque_fragment>`,
          );
      };
      material.customProgramCacheKey = () => "area-mist-v1";
      return material;
    },
  };
}
