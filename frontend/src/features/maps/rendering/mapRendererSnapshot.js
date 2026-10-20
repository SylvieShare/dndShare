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
    await assets.ensure(ids, runtime.tier, runtime.options);
    signal?.throwIfAborted();
    if (runtime.current.lightingEnabled)
      await assets.ensure(ids, "shadow", runtime.options);
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
