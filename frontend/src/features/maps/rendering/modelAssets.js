import { missingModels, modelLoadError } from "../lib/modelLoadError";
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
  onCatalogue = () => {},
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
    queuedProgress = false,
    catalogueFile,
    refreshing = false;
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
      const file = plan.get(url);
      const state =
        file?.state ||
        modelDownloads.get(file?.key || resourceKey(url, loader));
      if (file?.kind === "catalogue") return state;
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
    snapshot.errors = files.flatMap((file) => {
      const state =
        file.state ||
        modelDownloads.get(file.key || resourceKey(file.url, loader));
      return state?.error
        ? [
            {
              ...state.error,
              message: state.error.message,
              key: file.key || resourceKey(file.url, loader),
              attempt: state.attempt,
              nextRetryAt: state.nextRetryAt,
              statusCode: state.error.status,
              status: state.status,
            },
          ]
        : [];
    });
    const key = JSON.stringify(snapshot);
    if (key !== lastProgress) {
      lastProgress = key;
      onProgress(snapshot);
    }
  }
  const unsubscribe = modelDownloads.subscribe(progress);
  async function prepare(ids, options = {}) {
    if (
      options.catalogueRequest &&
      options.catalogueRequest !== catalogueFile
    ) {
      catalogueFile = options.catalogueRequest;
      plan.set(catalogueFile.url, catalogueFile);
      progress();
    }
    const key = options.publicCode
      ? `${options.publicCode}:${[...ids].sort().join(",")}`
      : "private";
    if (
      !refreshing &&
      catalogueKey === key &&
      catalogue.size &&
      (!options.catalogue || options.catalogue === sourceCatalogue) &&
      [...ids].every((id) => catalogue.has(id))
    )
      return;
    if (preparing?.key === key && preparing.source === options.catalogue)
      return preparing.promise;
    const task = {
      key,
      source: options.catalogue,
      promise: null,
      controller: new AbortController(),
    };
    preparing?.controller.abort();
    preparing = task;
    const promise = (async () => {
      let models = options.catalogue || [];
      if (
        ids.size &&
        (refreshing ||
          !models.length ||
          [...ids].some((id) => !models.some((m) => m.id === id)))
      ) {
        models = await getMapModels(options.publicCode, {
          signal: task.controller.signal,
          onRequest: (file) => {
            catalogueFile = file;
            plan.set(file.url, file);
            progress();
          },
        });
      }
      if (dead || preparing !== task) return;
      const next = new Map(models.map((m) => [m.id, m]));
      const missing = [...ids].filter((id) => !next.has(id));
      if (missing.length) throw missingModels(missing);
      refreshing = false;
      catalogue = next;
      if (models !== options.catalogue) onCatalogue(models);
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
    if (!metadata) return Promise.reject(missingModels([id]));
    const url = metadata[`${tier}Url`];
    if (!url)
      return Promise.reject(
        modelLoadError(null, {
          message: "В каталоге не задан файл модели",
          stage: "catalogue",
          kind: "file-missing",
          modelId: id,
          definitionId: metadata.definitionId,
          modelName: metadata.name,
          assetKind: tier,
          retryable: false,
        }),
      );
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
        {
          modelId: id,
          definitionId: metadata.definitionId,
          modelName: metadata.name,
          assetKind: tier,
          resource: true,
        },
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
    if (!dead && error.name !== "AbortError" && !error.resource) onError(error);
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
    if (catalogueFile) plan.set(catalogueFile.url, catalogueFile);
    for (const [url, entry] of owned) {
      if (
        !plan.has(url) &&
        !entry.value &&
        !entry.error &&
        ["queued", "retrying"].includes(
          modelDownloads.get(resourceKey(url, loader))?.status,
        )
      ) {
        owned.delete(url);
        release(url, loader);
      }
    }
    progress();
    for (const id of ids) {
      const metadata = catalogue.get(id);
      if (!metadata) {
        report(missingModels([id]));
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
    retryFailed(refreshCatalogue = false) {
      if (refreshCatalogue) {
        refreshing = true;
        catalogueKey = "";
      }
      for (const file of plan.values())
        modelDownloads.retry(file.key || resourceKey(file.url, loader));
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
      preparing?.controller.abort();
      unsubscribe();
      owned.forEach((_, url) => release(url, loader));
      owned.clear();
      loader.release();
    },
  };
}
