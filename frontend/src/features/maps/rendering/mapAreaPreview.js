import {
  Box3,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  OrthographicCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderTarget,
} from "three";
import { createTileLayer } from "./tileLayer";
import { buildSceneObjects, disposeObjects } from "./sceneObjects";

// Only the focused area has an isolated scene. Geometry/textures and the GPU are
// borrowed from the map; no extra context, loader, shadow pass or animation loop.
export function createMapAreaPreview(gpu, assets, invalidate) {
  const observers = new Set();
  let current;
  function release(item) {
    item.tiles?.destroy();
    if (item.objects) disposeObjects(item.objects);
    item.target?.dispose();
    item.tiles = item.objects = item.target = null;
  }
  function capture(item, d, placed, objects) {
    const tier = "lod",
      area = d.areas.find((a) => a.id === item.id);
    if (!area) return;
    const tileIds = new Set(area.tileIds),
      objectIds = new Set(area.objectIds);
    const selectedTiles = placed.filter((t) => tileIds.has(t.id));
    const selectedObjects = objects.filter((o) => objectIds.has(o.id));
    const ids = new Set(
      [...selectedTiles, ...selectedObjects]
        .map((o) => o.modelId)
        .filter(Boolean),
    );
    const width = Math.max(
        1,
        Math.round(
          item.canvas.clientWidth * Math.min(devicePixelRatio || 1, 1.5),
        ),
      ),
      height = Math.max(
        1,
        Math.round(
          item.canvas.clientHeight * Math.min(devicePixelRatio || 1, 1.5),
        ),
      );
    const key = JSON.stringify([
      selectedTiles,
      selectedObjects,
      [...ids].map((id) => assets.metadata(id)),
      assets.signature(ids, tier),
      width,
      height,
    ]);
    if (key === item.key) return;
    item.key = key;
    release(item);
    const scene = new Scene();
    scene.background = new Color(0x161b23);
    const sun = new DirectionalLight(0xfff2df, 3);
    sun.position.set(-20, 40, -25);
    scene.add(new HemisphereLight(0xffffff, 0x625141, 2), sun);
    const fog = { material: (m) => m };
    item.tiles = createTileLayer(assets, fog);
    item.tiles.rebuild(selectedTiles, tier, []);
    item.tiles.advance(1000);
    item.objects = buildSceneObjects(
      { ...d, objects: selectedObjects },
      null,
      {},
      fog,
      assets,
      tier,
    );
    const content = new Group();
    content.add(item.tiles.root, item.objects);
    scene.add(content);
    content.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(content);
    if (bounds.isEmpty()) {
      item.changed("waiting");
      return;
    }
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0.01, 2000),
      center = bounds.getCenter(new Vector3());
    camera.position.copy(center).add(new Vector3(500, 408, 500));
    camera.lookAt(center);
    camera.updateMatrixWorld(true);
    const viewBounds = new Box3();
    for (const x of [bounds.min.x, bounds.max.x])
      for (const y of [bounds.min.y, bounds.max.y])
        for (const z of [bounds.min.z, bounds.max.z])
          viewBounds.expandByPoint(
            new Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse),
          );
    const span =
      Math.max(
        viewBounds.max.y - viewBounds.min.y,
        ((viewBounds.max.x - viewBounds.min.x) * height) / width,
        0.5,
      ) * 1.15;
    camera.top = span / 2;
    camera.bottom = -span / 2;
    camera.left = (-span * width) / height / 2;
    camera.right = -camera.left;
    camera.updateProjectionMatrix();
    item.target = new WebGLRenderTarget(width, height, { samples: 4 });
    item.target.texture.colorSpace = SRGBColorSpace;
    const previous = gpu.getRenderTarget(),
      shadows = gpu.shadowMap.enabled;
    try {
      gpu.shadowMap.enabled = false;
      gpu.setRenderTarget(item.target);
      gpu.render(scene, camera);
      gpu.setRenderTarget(previous);
      const pixels = new Uint8Array(width * height * 4);
      gpu.readRenderTargetPixels(item.target, 0, 0, width, height, pixels);
      const ctx = item.canvas.getContext("2d"),
        image = ctx.createImageData(width, height);
      for (let y = 0; y < height; y++)
        image.data.set(
          pixels.subarray(
            (height - y - 1) * width * 4,
            (height - y) * width * 4,
          ),
          y * width * 4,
        );
      item.canvas.width = width;
      item.canvas.height = height;
      ctx.putImageData(image, 0, 0);
      item.changed("ready");
    } catch {
      item.key = "";
      item.changed("unavailable");
    } finally {
      gpu.setRenderTarget(previous);
      gpu.shadowMap.enabled = shadows;
    }
  }
  return {
    observe(canvas, id, changed) {
      const item = { canvas, id, changed, key: "" };
      observers.add(item);
      if (current) capture(item, ...current);
      invalidate();
      return () => {
        observers.delete(item);
        release(item);
      };
    },
    update(d, placed, objects) {
      current = [d, placed, objects];
      for (const item of observers) capture(item, ...current);
    },
    destroy() {
      observers.forEach(release);
      observers.clear();
    },
  };
}
