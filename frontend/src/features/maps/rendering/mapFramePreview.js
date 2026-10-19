import { Vector3 } from "three";
import { FIRE_FPS } from "./fireMotion";

// Reuse the just-presented framebuffer. This never renders a second camera/view.
export function createMapFramePreview(camera, invalidate) {
  const observers = new Set(),
    projected = new Vector3();
  let timer = 0;
  return {
    observe(target, id, changed) {
      const observer = {
        target,
        id,
        changed,
        captured: false,
        state: "",
        at: -Infinity,
      };
      observers.add(observer);
      invalidate();
      return () => {
        observers.delete(observer);
        if (!observers.size) {
          clearTimeout(timer);
          timer = 0;
        }
      };
    },
    copy(source, pointFor) {
      for (const item of observers) {
        if (item.target.checkVisibility?.() === false) continue;
        const point = pointFor(item.id),
          target = item.target;
        let state = "waiting";
        if (point) {
          projected.copy(point).project(camera);
          const visible =
            [projected.x, projected.y, projected.z].every(Number.isFinite) &&
            Math.abs(projected.x) <= 1 &&
            Math.abs(projected.y) <= 1 &&
            Math.abs(projected.z) <= 1;
          state = visible ? "live" : "outside";
          if (visible) {
            const ratio = Math.min(globalThis.devicePixelRatio || 1, 1.5);
            const width = Math.max(1, Math.round(target.clientWidth * ratio)),
              height = Math.max(1, Math.round(target.clientHeight * ratio));
            const sourceRatio = source.clientWidth
              ? source.width / source.clientWidth
              : ratio;
            const cropWidth = target.clientWidth * sourceRatio * 1.6,
              cropHeight = target.clientHeight * sourceRatio * 1.6;
            const x = ((projected.x + 1) * source.width) / 2 - cropWidth / 2,
              y = ((1 - projected.y) * source.height) / 2 - cropHeight / 2;
            // Never clear/resize the last complete frame for a partial crop.
            if (
              x < 0 ||
              y < 0 ||
              x + cropWidth > source.width ||
              y + cropHeight > source.height
            )
              state = "outside";
            else {
              const at = performance.now(),
                delay = 1000 / FIRE_FPS - (at - item.at);
              if (item.state === "live:true" && delay > 0) {
                if (!timer)
                  timer = setTimeout(() => {
                    timer = 0;
                    invalidate();
                  }, delay);
                continue;
              }
              try {
                if (width !== target.width || height !== target.height) {
                  target.width = width;
                  target.height = height;
                }
                const ctx = target.getContext("2d");
                ctx.clearRect(0, 0, width, height);
                ctx.drawImage(
                  source,
                  x,
                  y,
                  cropWidth,
                  cropHeight,
                  0,
                  0,
                  width,
                  height,
                );
                item.captured = true;
                item.at = at;
              } catch {
                state = "unavailable";
              }
            }
          }
        }
        const next = `${state}:${item.captured}`;
        if (next !== item.state) {
          item.state = next;
          item.changed({ state, captured: item.captured });
        }
      }
    },
    destroy() {
      clearTimeout(timer);
      observers.clear();
    },
  };
}
