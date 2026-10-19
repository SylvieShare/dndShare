import { acquireModelLoader } from "./modelLoader";
import { getMapModels } from "@/shared/api/mapsApi";
import {
  acquire,
  release,
  prioritize,
  resourceKey,
  cachedModel,
} from "./modelResourceCache";
import { modelDownloads } from "./modelDownloadManager";
import { modelFile, modelDownloadPlan } from "./modelDownloadProgress";
import { createModelDownloadSession } from "./modelDownloadSession";
import { pruneModelResidency } from "./modelResidency";
import { residentModelUsage } from "./modelMemoryUsage";
export function modelAssets(
  onError,
  renderer,
  onChange = () => {},
  onProgress = () => {},
) {
  const loader = acquireModelLoader(renderer),
    owned = new Map(),
    sessionProgress = createModelDownloadSession();
  let catalogue = new Map(),
    catalogueKey = "",
    sourceCatalogue,
    preparing,
    dead = false,
    plan = new Map(),
    lastProgress = "",
    serial = 0,
    memoryVersion = 0,
    memoryAt = -1,
    memory,
    queuedProgress = false;
  function progress() {
    if (dead || queuedProgress) return;
    queuedProgress = true;
    queueMicrotask(() => {
      queuedProgress = false;
      publish();
    });
  }
  function publish() {
    if (dead) return;
    const files = [...plan.values()].filter(
      (file) =>
        !(
          file.kind === "lod" &&
          !file.requiredForShadow &&
          owned.get(file.url)?.error &&
          owned.get(file.fallbackUrl)?.value
        ),
    );
    const snapshot = sessionProgress(files, (url) => {
      const state = modelDownloads.get(resourceKey(url, loader));
      const entry = owned.get(url);
      return entry?.value || cachedModel(url, loader)
        ? { ...state, status: "ready" }
        : entry?.error
          ? { ...state, status: "failed" }
          : state?.status === "ready"
            ? { ...state, status: "processing" }
            : state;
    });
    if (memoryAt !== memoryVersion) {
      memory = residentModelUsage(owned, catalogue);
      memoryAt = memoryVersion;
    }
    snapshot.memory = memory;
    const key = JSON.stringify(snapshot);
    if (key !== lastProgress) {
      lastProgress = key;
      onProgress(snapshot);
    }
  }
  const unsubscribe = modelDownloads.subscribe(progress);
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
      memoryVersion++;
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
    if (!plan.has(url)) plan.set(url, modelFile(metadata, tier));
    let entry = owned.get(url);
    if (!entry) {
      entry = { value: null, error: null, used: ++serial };
      owned.set(url, entry);
      entry.promise = acquire(
        url,
        loader,
        priority,
        metadata.assetBytes?.[tier] || 0,
      )
        .then((value) => {
          if (!dead && owned.get(url) === entry) {
            entry.value = value;
            memoryVersion++;
            progress();
            onChange();
          }
          return value;
        })
        .catch((error) => {
          entry.error = error;
          if (!dead) {
            progress();
            onChange();
          }
          throw error;
        });
      entry.promise.catch(() => {});
    }
    entry.used = ++serial;
    prioritize(url, loader, priority);
    progress();
    return entry.promise;
  }
  function model(id, tier) {
    const m = catalogue.get(id),
      url = m?.[`${tier}Url`];
    if (!url) return null;
    const value = owned.get(url)?.value || cachedModel(url, loader);
    if (value && !owned.has(url)) request(id, tier).catch(report);
    return value;
  }
  function visualTier(id, tier) {
    if (model(id, tier)) return tier;
    const other = tier === "lod" ? "render" : "lod";
    return model(id, other) ? other : "";
  }
  function report(error) {
    if (!dead && error.name !== "AbortError") onError(error.message);
  }
  function progressive(
    ids,
    tier,
    details = new Set(),
    shadows = false,
    shadowIds = ids,
    detailTier = "render",
  ) {
    plan = modelDownloadPlan(
      catalogue,
      ids,
      tier,
      details,
      shadows,
      shadowIds,
      detailTier,
    );
    for (const [url, entry] of owned) {
      if (
        !plan.has(url) &&
        !entry.value &&
        !entry.error &&
        modelDownloads.get(resourceKey(url, loader))?.status === "queued"
      ) {
        owned.delete(url);
        release(url, loader);
      }
    }
    progress();
    for (const id of ids) {
      const metadata = catalogue.get(id);
      if (!metadata) {
        report(new Error("Модель плитки отсутствует в каталоге"));
        continue;
      }
      request(id, "lod", 1)
        .catch(() => null)
        .then((lod) => {
          if (
            dead ||
            catalogue.get(id) !== metadata ||
            (!plan.has(metadata.lodUrl) && !plan.has(metadata.renderUrl))
          )
            return;
          if (plan.has(metadata.renderUrl) || !lod)
            return request(id, "render", 0);
        })
        .catch(report);
    }
    for (const id of details)
      request(id, detailTier, 2)
        .catch((error) => {
          if (detailTier === "lod") return request(id, "render", 2);
          throw error;
        })
        .catch(report);
    if (shadows)
      for (const id of new Set([...shadowIds, ...details]))
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
      memoryVersion++;
    },
    prune(limits) {
      const remove = (url) => {
        owned.delete(url);
        memoryVersion++;
        release(url, loader);
      };
      const urls = new Set(
        [...catalogue.values()].flatMap((m) => [
          m.renderUrl,
          m.lodUrl,
          m.shadowUrl,
        ]),
      );
      for (const url of owned.keys()) if (!urls.has(url)) remove(url);
      pruneModelResidency(owned, plan, remove, limits);
      progress();
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
      unsubscribe();
      owned.forEach((_, url) => release(url, loader));
      owned.clear();
      loader.release();
    },
  };
}
