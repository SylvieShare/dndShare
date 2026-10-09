import { acquireModelLoader } from "./modelLoader";
import { getMapModels } from "@/shared/api/mapsApi";
import { acquire, release, prioritize } from "./modelResourceCache";
export function modelAssets(onError, renderer, onChange = () => {}) {
  const loader = acquireModelLoader(renderer),
    owned = new Map();
  let catalogue = new Map(),
    catalogueKey = "",
    sourceCatalogue,
    preparing,
    dead = false,
    wanted = new Set();
  async function prepare(ids, options = {}) {
    const key = options.publicCode
      ? `${options.publicCode}:${[...ids].sort().join(",")}`
      : "private";
    if (
      catalogueKey === key &&
      catalogue.size &&
      (!options.catalogue || options.catalogue === sourceCatalogue)
    )
      return;
    if (preparing?.key === key && preparing.source === options.catalogue)
      return preparing.promise;
    const task = { key, source: options.catalogue, promise: null };
    preparing = task;
    const promise = (async () => {
      const models =
        options.catalogue?.length || !ids.size
          ? options.catalogue || []
          : await getMapModels(options.publicCode);
      if (dead || preparing !== task) return;
      catalogue = new Map(models.map((m) => [m.id, m]));
      catalogueKey = key;
      sourceCatalogue = options.catalogue;
    })();
    task.promise = promise;
    try {
      await promise;
    } finally {
      if (preparing === task) preparing = null;
    }
  }
  function request(id, tier, priority = 0) {
    const metadata = catalogue.get(id);
    if (!metadata)
      return Promise.reject(new Error("Модель плитки отсутствует в каталоге"));
    const url = metadata[`${tier}Url`];
    if (!url)
      return Promise.reject(new Error("У модели отсутствует файл " + tier));
    let entry = owned.get(url);
    if (!entry) {
      entry = { value: null, error: null };
      owned.set(url, entry);
      entry.promise = acquire(url, loader, priority)
        .then((value) => {
          if (!dead && owned.get(url) === entry) {
            entry.value = value;
            onChange();
          }
          return value;
        })
        .catch((error) => {
          entry.error = error;
          if (!dead) onChange();
          throw error;
        });
      entry.promise.catch(() => {});
    }
    prioritize(url, loader, priority);
    return entry.promise;
  }
  function model(id, tier) {
    const m = catalogue.get(id);
    return m && owned.get(m[`${tier}Url`])?.value;
  }
  function visualTier(id, tier) {
    if (model(id, tier)) return tier;
    const other = tier === "lod" ? "render" : "lod";
    return model(id, other) ? other : "";
  }
  function report(error) {
    if (!dead && error.name !== "AbortError") onError(error.message);
  }
  function progressive(ids, tier, details = new Set(), shadows = false) {
    wanted = new Set(
      [...ids].flatMap((id) => {
        const m = catalogue.get(id);
        return m
          ? [
              m.lodUrl,
              ...(tier === "render" ? [m.renderUrl] : []),
              ...(shadows ? [m.shadowUrl] : []),
            ]
          : [];
      }),
    );
    for (const id of details) {
      const m = catalogue.get(id);
      if (m) wanted.add(m.renderUrl);
    }
    for (const id of ids) {
      const metadata = catalogue.get(id);
      if (!metadata) {
        report(new Error("Модель плитки отсутствует в каталоге"));
        continue;
      }
      request(id, "lod", 1)
        .catch(() => null)
        .then((lod) => {
          if (dead || catalogue.get(id) !== metadata) return;
          if (wanted.has(metadata.renderUrl) || !lod)
            return request(id, "render", 0);
        })
        .catch(report);
    }
    for (const id of details) request(id, "render", 2).catch(report);
    if (shadows)
      for (const id of new Set([...ids, ...details]))
        request(id, "shadow", -1).catch(report);
  }
  return {
    prepare,
    progressive,
    async ensure(ids, tier, options = {}) {
      await prepare(ids, options);
      if (dead) return;
      await Promise.all([...ids].map((id) => request(id, tier)));
    },
    retryFailed() {
      for (const [url, entry] of owned)
        if (entry.error) {
          owned.delete(url);
          release(url, loader);
        }
    },
    replaceCatalogue(models) {
      catalogue = new Map(models.map((m) => [m.id, m]));
    },
    prune() {
      const urls = new Set(
        [...catalogue.values()].flatMap((m) => [
          m.renderUrl,
          m.lodUrl,
          m.shadowUrl,
        ]),
      );
      for (const url of owned.keys())
        if (!urls.has(url)) {
          owned.delete(url);
          release(url, loader);
        }
    },
    metadata: (id) => catalogue.get(id),
    catalogue: () => [...catalogue.values()],
    model,
    visual(id, tier) {
      const available = visualTier(id, tier);
      return available ? model(id, available) : null;
    },
    signature(ids, tier) {
      return [...ids].map((id) => {
        const available = visualTier(id, tier),
          m = catalogue.get(id);
        return available ? m?.[`${available}Url`] : "";
      });
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
