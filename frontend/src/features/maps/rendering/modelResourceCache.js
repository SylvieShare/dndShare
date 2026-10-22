import { modelLoadError } from "../lib/modelLoadError";
import { modelMemoryUsage } from "./modelMemoryUsage";
import { modelDownloads } from "./modelDownloadManager";
import { prepareModelPicking } from "./modelPicking";
const cache = new Map();
export const resourceKey = (url, loader) => `${loader.key}:${url}`;
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
  geometries.forEach((v) => {
    v.boundsTree = null;
    v.dispose();
  });
  materials.forEach((v) => v.dispose());
  textures.forEach((v) => {
    images.add(v.source?.data);
    v.dispose();
  });
  images.forEach((v) => v?.close?.());
}
export function acquire(url, loader, priority = 0, bytes = 0, context = {}) {
  const key = resourceKey(url, loader);
  let entry = cache.get(key);
  if (!entry) {
    entry = { refs: 0, priority, progress: { total: bytes } };
    cache.set(key, entry);
    entry.promise = modelDownloads.schedule(
      key,
      async (signal) => {
        let parts = [];
        try {
          if (!entry.refs) throw new DOMException("Cancelled", "AbortError");
          const gltf = await loader.load(
            url,
            (fn) => fn(),
            (event) => modelDownloads.progress(entry.progress, event),
            signal,
            bytes,
          );
          gltf.scene.updateMatrixWorld(true);
          gltf.scene.traverse((node) => {
            if (node.isMesh)
              parts.push({
                geometry: node.geometry,
                material: node.material,
                matrix: node.matrixWorld.clone(),
              });
          });
          if (!parts.length)
            throw modelLoadError(new Error("В файле модели нет геометрии"), {
              stage: "geometry",
              kind: "invalid-model",
              retryable: false,
            });
          signal.throwIfAborted();
          entry.progress.stage = "geometry";
          await Promise.all(
            parts.map((part) => prepareModelPicking(part.geometry)),
          );
          signal.throwIfAborted();
          entry.value = {
            parts,
            usage: modelMemoryUsage(parts),
            fileBytes: Math.max(
              entry.progress.loaded || 0,
              entry.progress.total || 0,
            ),
          };
          return entry.value;
        } catch (error) {
          if (parts.length) dispose({ parts });
          throw modelLoadError(error, {
            ...context,
            url,
            stage: error.stage || entry.progress.stage || "download",
          });
        }
      },
      () => entry.priority,
      entry.progress,
      { retry: (error) => error.retryable === true },
    );
  }
  entry.priority = Math.max(entry.priority, priority);
  entry.refs++;
  return entry.promise;
}
export function release(url, loader) {
  const key = resourceKey(url, loader),
    entry = cache.get(key);
  if (!entry || --entry.refs > 0) return;
  cache.delete(key);
  modelDownloads.remove(key);
  entry.promise.then(dispose).catch(() => {});
}

export function prioritize(url, loader, priority) {
  const entry = cache.get(resourceKey(url, loader));
  if (entry) entry.priority = Math.max(entry.priority, priority);
}

export const cachedModel = (url, loader) =>
  cache.get(resourceKey(url, loader))?.value;
