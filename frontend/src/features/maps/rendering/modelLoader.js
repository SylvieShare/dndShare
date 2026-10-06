import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

const profiles = new Map();

export function acquireModelLoader(renderer) {
  const decoder = new KTX2Loader().setWorkerLimit(2).detectSupport(renderer);
  const key = JSON.stringify(decoder.workerConfig);
  let profile = profiles.get(key);
  if (profile) decoder.dispose();
  else {
    profile = {
      refs: 0,
      pending: 0,
      decoder,
      loader: new GLTFLoader()
        .setMeshoptDecoder(MeshoptDecoder)
        .setKTX2Loader(decoder),
    };
    profiles.set(key, profile);
  }
  profile.refs++;
  let released = false;
  function cleanup() {
    if (profile.refs || profile.pending) return;
    if (profiles.get(key) === profile) profiles.delete(key);
    profile.decoder.dispose();
  }
  return {
    key,
    async load(url, schedule = (fn) => fn()) {
      profile.pending++;
      try {
        return await schedule(() => profile.loader.loadAsync(url));
      } finally {
        profile.pending--;
        cleanup();
      }
    },
    release() {
      if (released) return;
      released = true;
      profile.refs--;
      cleanup();
    },
  };
}
