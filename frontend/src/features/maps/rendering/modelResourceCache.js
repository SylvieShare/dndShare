const cache = new Map(),
  queue = [];
let loading = 0;
function drain() {
  while (loading < 3 && queue.length) {
    queue.sort((a, b) => b.priority() - a.priority());
    const job = queue.shift();
    loading++;
    Promise.resolve()
      .then(job.run)
      .then(job.resolve, job.reject)
      .finally(() => {
        loading--;
        drain();
      });
  }
}
function schedule(run, priority) {
  return new Promise((resolve, reject) => {
    queue.push({ run, priority, resolve, reject });
    drain();
  });
}
function dispose(model) {
  const geometries = new Set(),
    materials = new Set(),
    textures = new Set(),
    images = new Set();
  for (const part of model.parts) {
    geometries.add(part.geometry);
    for (const material of Array.isArray(part.material)
      ? part.material
      : [part.material]) {
      materials.add(material);
      for (const value of Object.values(material))
        if (value?.isTexture) textures.add(value);
    }
  }
  geometries.forEach((v) => v.dispose());
  materials.forEach((v) => v.dispose());
  textures.forEach((v) => {
    images.add(v.source?.data);
    v.dispose();
  });
  images.forEach((v) => v?.close?.());
}
export function acquire(url, loader, priority = 0) {
  const key = `${loader.key}:${url}`;
  let entry = cache.get(key);
  if (!entry) {
    entry = { refs: 0, priority };
    cache.set(key, entry);
    entry.promise = loader
      .load(url, (fn) =>
        schedule(
          () => {
            if (!entry.refs) throw new DOMException("Cancelled", "AbortError");
            return fn();
          },
          () => entry.priority,
        ),
      )
      .then((gltf) => {
        gltf.scene.updateMatrixWorld(true);
        const parts = [];
        gltf.scene.traverse((node) => {
          if (node.isMesh)
            parts.push({
              geometry: node.geometry,
              material: node.material,
              matrix: node.matrixWorld.clone(),
            });
        });
        if (!parts.length) throw new Error("В модели нет геометрии");
        return { parts };
      });
  }
  entry.priority = Math.max(entry.priority, priority);
  entry.refs++;
  return entry.promise;
}
export function release(url, loader) {
  const key = `${loader.key}:${url}`,
    entry = cache.get(key);
  if (!entry || --entry.refs > 0) return;
  cache.delete(key);
  entry.promise.then(dispose).catch(() => {});
}

export function prioritize(url, loader, priority) {
  const entry = cache.get(`${loader.key}:${url}`);
  if (entry) entry.priority = Math.max(entry.priority, priority);
}
