import { Scene, Vector2 } from "three";

// Transparent grid lines must blend after tone mapping, just like the direct
// renderer. Blending them into the linear fog target makes them much brighter.
export function createFogGridOverlay(gpu) {
  const scene = new Scene();
  scene.userData.renderCategory = "fog";
  const uniforms = {
    gridSceneDepth: { value: null },
    gridFog: { value: null },
    gridViewport: { value: new Vector2() },
  };
  let source, copy, hidden;
  return {
    prepare(root, depth, mist, size) {
      let grid;
      root.traverseVisible((node) => {
        if (node.userData.mapGrid) grid = node;
      });
      if (grid !== source) {
        copy?.material.dispose();
        scene.clear();
        source = grid;
        copy = grid?.clone(false);
        if (copy) {
          copy.material = grid.material.clone();
          copy.material.depthTest = false;
          copy.material.onBeforeCompile = (shader) => {
            Object.assign(shader.uniforms, uniforms);
            shader.fragmentShader = shader.fragmentShader
              .replace(
                "#include <common>",
                `#include <common>
uniform sampler2D gridSceneDepth;
uniform sampler2D gridFog;
uniform vec2 gridViewport;`,
              )
              .replace(
                "#include <clipping_planes_fragment>",
                `#include <clipping_planes_fragment>
vec2 gridUV = gl_FragCoord.xy / gridViewport;
if (gl_FragCoord.z > texture2D(gridSceneDepth, gridUV).r + 0.0000001) discard;`,
              )
              .replace(
                "#include <opaque_fragment>",
                `
diffuseColor.a *= 1.0 - texture2D(gridFog, gridUV).a;
#include <opaque_fragment>`,
              );
          };
          copy.material.customProgramCacheKey = () => "fog-grid-overlay-v1";
          copy.matrixAutoUpdate = false;
          scene.add(copy);
        }
      }
      if (!grid) return;
      grid.updateWorldMatrix(true, false);
      copy.matrix.copy(grid.matrixWorld);
      uniforms.gridSceneDepth.value = depth;
      uniforms.gridFog.value = mist;
      uniforms.gridViewport.value.copy(size);
      hidden = grid;
      grid.visible = false;
    },
    render(camera) {
      if (!copy) return;
      const autoClear = gpu.autoClear;
      try {
        gpu.autoClear = false;
        gpu.render(scene, camera);
      } finally {
        gpu.autoClear = autoClear;
      }
    },
    restore() {
      if (hidden) hidden.visible = true;
      hidden = null;
    },
    destroy() {
      copy?.material.dispose();
      scene.clear();
    },
  };
}
