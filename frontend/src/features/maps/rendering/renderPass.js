import { Color } from "three";

// All auxiliary passes restore the same renderer state, including on failure.
export function renderPass(gpu, scene, draw) {
  const state = {
    target: gpu.getRenderTarget(),
    autoClear: gpu.autoClear,
    shadows: gpu.shadowMap.enabled,
    colour: new Color(),
    alpha: gpu.getClearAlpha(),
    background: scene?.background,
    override: scene?.overrideMaterial,
  };
  gpu.getClearColor(state.colour);
  try {
    return draw(state);
  } finally {
    gpu.setRenderTarget(state.target);
    gpu.autoClear = state.autoClear;
    gpu.shadowMap.enabled = state.shadows;
    gpu.setClearColor(state.colour, state.alpha);
    if (scene) {
      scene.background = state.background;
      scene.overrideMaterial = state.override;
    }
  }
}
