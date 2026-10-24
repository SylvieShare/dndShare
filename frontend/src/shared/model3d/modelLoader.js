import { fetchModelResource } from "./fetchModelResource";
import { modelLoadError } from "./modelLoadError";
import { LoadingManager } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

class ModelTextureLoader extends KTX2Loader {
  constructor() {
    super(new LoadingManager());
    this.modelTimedOut = false;
  }
  init() {
    const timer = setTimeout(() => {
      this.modelTimedOut = true;
      this.manager.abort();
    }, 120000);
    return super
      .init()
      .catch((error) => {
        if (this.modelTimedOut)
          throw new Error("Не удалось получить декодер текстур за 120 секунд");
        throw error;
      })
      .finally(() => clearTimeout(timer));
  }
}

const profiles = new Map();

export function acquireModelLoader(renderer) {
  const decoder = new ModelTextureLoader()
    .setWorkerLimit(2)
    .detectSupport(renderer);
  const key = JSON.stringify(decoder.workerConfig);
  let profile = profiles.get(key);
  if (profile) decoder.dispose();
  else {
    profile = {
      refs: 0,
      renderers: new Set(),
      reset: null,
      pending: 0,
      decoder,
      loader: new GLTFLoader()
        .setMeshoptDecoder(MeshoptDecoder)
        .setKTX2Loader(decoder),
    };
    profiles.set(key, profile);
  }
  profile.refs++;
  profile.renderers.add(renderer);
  let released = false;
  function cleanup() {
    if (profile.refs || profile.pending) return;
    if (profiles.get(key) === profile) profiles.delete(key);
    profile.decoder.dispose();
  }
  return {
    key,
    async load(url, schedule = (fn) => fn(), onProgress, signal, bytes) {
      if (profile.reset) await profile.reset.promise;
      signal?.throwIfAborted();
      profile.pending++;
      try {
        return await schedule(async () => {
          const data = await fetchModelResource(url, {
            signal,
            onProgress,
            bytes,
          });
          signal?.throwIfAborted();
          try {
            return await profile.loader.parseAsync(
              data,
              new URL(
                ".",
                new URL(url, globalThis.location?.href || "http://localhost"),
              ).href,
            );
          } catch (error) {
            // A failed KTX2 initialization is cached by its loader. Replace it
            // only after every current parse has settled; never terminate a worker in use.
            if (!profile.reset) {
              let resolve;
              const promise = new Promise((done) => (resolve = done));
              profile.reset = { promise, resolve };
            }
            throw modelLoadError(error, { url, stage: "decode" });
          }
        });
      } finally {
        profile.pending--;
        if (!profile.pending && profile.reset) {
          const reset = profile.reset;
          profile.reset = null;
          if (profile.refs) {
            profile.decoder.dispose();
            profile.decoder = new ModelTextureLoader()
              .setWorkerLimit(2)
              .detectSupport(profile.renderers.values().next().value);
            profile.loader.setKTX2Loader(profile.decoder);
          }
          reset.resolve();
        }
        cleanup();
      }
    },
    release() {
      if (released) return;
      released = true;
      profile.refs--;
      profile.renderers.delete(renderer);
      if (!profile.refs) profile.decoder.manager?.abort();
      cleanup();
    },
  };
}
