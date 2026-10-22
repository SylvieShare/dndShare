import { previewTask } from "../lib/previewTask";
export function createMapSnapshot({
  runtime,
  assets,
  update,
  tiles,
  objectMotion,
  objects,
  lighting,
  objectPreview,
  effects,
  decals,
  water,
  volumeFog,
  scene,
  camera,
  gpu,
}) {
  return async (signal) => {
    signal?.throwIfAborted();
    const ids = new Set([
      ...runtime.current.tiles.map((t) => t.modelId),
      ...runtime.current.objects.map((o) => o.modelId).filter(Boolean),
    ]);
    await previewTask(
      assets.ensure(ids, runtime.tier, runtime.options),
      signal,
    );
    signal?.throwIfAborted();
    if (runtime.current.lightingEnabled)
      await previewTask(assets.ensure(ids, "shadow", runtime.options), signal);
    signal?.throwIfAborted();
    await update(runtime.current, runtime.state, {
      ...runtime.options,
      capture: true,
    });
    signal?.throwIfAborted();
    tiles.advance(1000);
    objectMotion.advance(1000, objects);
    lighting.advance(
      0,
      (id) => tiles.transform(id),
      objects,
      objectPreview.root,
    );
    effects.advance(
      0,
      1000,
      (id) => tiles.transform(id),
      objects,
      objectPreview.root,
    );
    await decals?.ready();
    signal?.throwIfAborted();
    decals?.advance();
    water.advance(0, false);
    volumeFog.render(scene, camera);
    return new Promise((resolve, reject) =>
      gpu.domElement.toBlob(
        (blob) => {
          if (signal?.aborted) reject(signal.reason);
          else if (blob) resolve(blob);
          else reject(new Error("Не удалось создать превью карты"));
        },
        "image/webp",
        0.88,
      ),
    );
  };
}
