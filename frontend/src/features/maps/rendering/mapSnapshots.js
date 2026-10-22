import { getMapModels } from "@/shared/api/mapsApi";
import { ISOMETRIC_AZIMUTH, ISOMETRIC_TILT } from "./mapCamera";
import { previewTask } from "../lib/previewTask";

const cache = new Map(),
  queue = [];
let running = false,
  renderer,
  host,
  idle;
export async function requestMapSnapshot(document, signal, options = {}) {
  signal?.throwIfAborted();
  const catalogue =
    options.catalogue || (await getMapModels(undefined, { signal }));
  const ids = new Set([
    ...document.tiles.map((t) => t.modelId),
    ...document.objects.map((o) => o.modelId).filter(Boolean),
  ]);
  const scene = JSON.parse(JSON.stringify(document));
  delete scene.tags;
  delete scene.cameras;
  const cameraView = options.view
    ? JSON.parse(JSON.stringify(options.view))
    : null;
  let key = options.key;
  if (!key) {
    const data = JSON.stringify([
      scene,
      cameraView,
      options.forceLod,
      catalogue.filter((m) => ids.has(m.id)),
    ]);
    const hash = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(data),
    );
    key = [...new Uint8Array(hash)]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
  }
  if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
  if (cache.has(key)) return cache.get(key);
  return previewTask(
    new Promise((resolve, reject) => {
      queue.push({
        key,
        document: scene,
        catalogue,
        signal,
        resolve,
        reject,
        view: cameraView,
        forceLod: options.forceLod,
      });
      pump();
    }),
    signal,
  );
}
function destroy() {
  renderer?.destroy();
  renderer = null;
  host?.remove();
  host = null;
}
async function pump() {
  if (running) return;
  running = true;
  clearTimeout(idle);
  try {
    while (queue.length) {
      const job = queue.shift();
      if (job.signal?.aborted) {
        job.reject(new DOMException("Cancelled", "AbortError"));
        continue;
      }
      try {
        if (cache.has(job.key)) {
          job.resolve(cache.get(job.key));
          continue;
        }
        if (!renderer) {
          host = window.document.createElement("div");
          host.setAttribute("aria-hidden", "true");
          host.style.cssText =
            "position:fixed;left:-10000px;top:0;width:420px;height:280px;pointer-events:none;visibility:hidden";
          window.document.body.append(host);
          const { createMapRenderer } = await import("./mapRenderer");
          renderer = await createMapRenderer(
            host,
            () => {},
            undefined,
            undefined,
            {
              snapshotOnly: true,
            },
          );
        }
        host.style.height = `${420 / (job.view?.aspect || 1.5)}px`;
        job.signal?.throwIfAborted();
        // The initial editor view, without selection, controls or light markers.
        const document = {
          ...job.document,
          lights: job.document.lights.map((l) => ({ ...l, flicker: false })),
        };
        await renderer.update(document, null, {
          master: true,
          forceLod: !!job.forceLod,
          showAnchors: false,
          animate: false,
          catalogue: job.catalogue,
        });
        job.signal?.throwIfAborted();
        renderer.camera({
          view: job.view || null,
          fit: !job.view,
          rotation: 0,
          azimuth: ISOMETRIC_AZIMUTH,
          tilt: ISOMETRIC_TILT,
        });
        const blob = await previewTask(
          renderer.snapshot(job.signal),
          job.signal,
        );
        job.signal?.throwIfAborted();
        cache.set(job.key, blob);
        if (cache.size > 64) cache.delete(cache.keys().next().value);
        job.resolve(blob);
      } catch (error) {
        if (!job.signal?.aborted) destroy();
        job.reject(error);
      }
    }
  } finally {
    running = false;
    idle = setTimeout(destroy, 15000);
  }
}
