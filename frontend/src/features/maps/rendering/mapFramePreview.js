import { Vector3 } from "three";

// Reuse the just-presented framebuffer. This never renders a second camera/view.
export function createMapFramePreview(camera, invalidate) {
  const observers = new Set(),
    projected = new Vector3();
  return {
    observe(target, id, changed) {
      const observer = { target, id, changed, captured: false, state: "" };
      observers.add(observer);
      invalidate();
      return () => observers.delete(observer);
    },
    copy(source, pointFor) {
      for (const item of observers) {
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
            if (width !== target.width || height !== target.height) {
              target.width = width;
              target.height = height;
            }
            const cropWidth = width * 1.6,
              cropHeight = height * 1.6;
            const x = ((projected.x + 1) * source.width) / 2 - cropWidth / 2,
              y = ((1 - projected.y) * source.height) / 2 - cropHeight / 2;
            const left = Math.max(0, x),
              top = Math.max(0, y),
              right = Math.min(source.width, x + cropWidth),
              bottom = Math.min(source.height, y + cropHeight);
            try {
              const ctx = target.getContext("2d");
              ctx.clearRect(0, 0, width, height);
              if (right > left && bottom > top)
                ctx.drawImage(
                  source,
                  left,
                  top,
                  right - left,
                  bottom - top,
                  ((left - x) * width) / cropWidth,
                  ((top - y) * height) / cropHeight,
                  ((right - left) * width) / cropWidth,
                  ((bottom - top) * height) / cropHeight,
                );
              item.captured = true;
            } catch {
              state = "unavailable";
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
    destroy: () => observers.clear(),
  };
}
