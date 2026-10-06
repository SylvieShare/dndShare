import { acquireModelLoader } from "./modelLoader";
import { getMapModels } from "@/shared/api/mapsApi";

const cache = new Map();
let loading = 0;
const queue = [];
async function limited(fn) {
  if (loading >= 3) await new Promise((resolve) => queue.push(resolve));
  loading++;
  try {
    return await fn();
  } finally {
    loading--;
    queue.shift()?.();
  }
}
function disposeModel(model) {
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
  geometries.forEach((value) => value.dispose());
  materials.forEach((value) => value.dispose());
  textures.forEach((value) => {
    images.add(value.source?.data);
    value.dispose();
  });
  images.forEach((value) => value?.close?.());
}
function acquire(url, loader) {
  const key = `${loader.key}:${url}`;
  let entry = cache.get(key);
  if (!entry) {
    entry = {
      refs: 0,
      promise: loader.load(url, limited).then((gltf) => {
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
      }),
    };
    cache.set(key, entry);
  }
  entry.refs++;
  return entry.promise;
}
function release(url, loader) {
  const key = `${loader.key}:${url}`;
  const entry = cache.get(key);
  if (!entry || --entry.refs > 0) return;
  cache.delete(key);
  entry.promise.then(disposeModel).catch(() => {});
}

export function modelAssets(onError, renderer) {
  const loader = acquireModelLoader(renderer);
  const owned = new Map();
  let catalogue = new Map(),
    catalogueKey = "",
    sourceCatalogue,
    dead = false;
  return {
    async ensure(ids, tier, options = {}) {
      const key = options.publicCode
        ? `${options.publicCode}:${[...ids].sort().join(",")}`
        : "private";
      if (
        catalogueKey !== key ||
        !catalogue.size ||
        (options.catalogue && options.catalogue !== sourceCatalogue)
      ) {
        const models = options.catalogue?.length
          ? options.catalogue
          : await getMapModels(options.publicCode);
        if (dead) return;
        catalogue = new Map(models.map((m) => [m.id, m]));
        catalogueKey = key;
        sourceCatalogue = options.catalogue;
      }
      await Promise.all(
        [...ids].map(async (id) => {
          const metadata = catalogue.get(id);
          if (!metadata)
            throw new Error("Модель плитки отсутствует в каталоге");
          const url = tier === "lod" ? metadata.lodUrl : metadata.renderUrl;
          if (!owned.has(url)) {
            const entry = { promise: acquire(url, loader), value: null };
            owned.set(url, entry);
            entry.promise
              .then((value) => {
                if (!dead) entry.value = value;
              })
              .catch((error) => {
                if (owned.get(url) === entry) {
                  owned.delete(url);
                  release(url, loader);
                }
                if (!dead) onError(error.message);
              });
          }
          await owned.get(url).promise;
        }),
      );
    },
    metadata(id) {
      return catalogue.get(id);
    },
    catalogue: () => [...catalogue.values()],
    model(id, tier) {
      const m = catalogue.get(id);
      return m && owned.get(tier === "lod" ? m.lodUrl : m.renderUrl)?.value;
    },
    destroy() {
      if (dead) return;
      dead = true;
      owned.forEach((_, url) => release(url, loader));
      owned.clear();
      loader.release();
    },
  };
}
