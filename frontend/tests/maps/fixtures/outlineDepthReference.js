import { Matrix4, MeshBasicMaterial, Vector2, WebGLRenderTarget } from "three";
import { renderPass } from "/src/features/maps/rendering/renderPass.js";

// Test-only reference for the previous cropped world-depth pass. Keeping this
// on the same GPU avoids platform-dependent screenshot goldens.
export function createOutlineDepthReference(gpu, world, ignored) {
  const target = new WebGLRenderTarget(1, 1, { samples: 4 });
  const depth = new MeshBasicMaterial({ colorWrite: false });
  const size = new Vector2(),
    crop = new Matrix4();
  return {
    mask(maskScene, view, region) {
      gpu.getDrawingBufferSize(size);
      target.setSize(size.x, size.y);
      target.viewport.set(region.x, region.y, region.width, region.height);
      target.scissor.copy(target.viewport);
      target.scissorTest = true;
      const camera = view.clone();
      crop.makeScale(size.x / region.width, size.y / region.height, 1);
      crop.elements[12] = (size.x - 2 * region.x - region.width) / region.width;
      crop.elements[13] =
        (size.y - 2 * region.y - region.height) / region.height;
      camera.projectionMatrix.premultiply(crop);
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      const hidden = ignored().map((node) => [node, node.visible]);
      renderPass(gpu, world, () => {
        try {
          gpu.setRenderTarget(target);
          gpu.setClearColor(0, 0);
          gpu.clear();
          world.background = null;
          world.overrideMaterial = depth;
          hidden.forEach(([node]) => (node.visible = false));
          gpu.render(world, camera);
          gpu.render(maskScene, camera);
        } finally {
          hidden.forEach(([node, visible]) => (node.visible = visible));
        }
      });
      return target.texture;
    },
    destroy() {
      target.dispose();
      depth.dispose();
    },
  };
}
