import { OrthographicCamera, Raycaster, Vector2, Vector3 } from "three";

export function createModelOrbitCamera(gpu, host, invalidate, options = {}) {
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.01, 2000);
  const target = new Vector3(),
    ray = new Raycaster();
  let yaw = options.yaw ?? Math.PI / 4,
    pitch = options.pitch ?? Math.atan(1 / Math.sqrt(2)),
    span = 4,
    zoom = 1,
    sizedWidth = 0,
    sizedHeight = 0;
  function update() {
    const width = Math.max(1, host.clientWidth),
      height = Math.max(1, host.clientHeight);
    if (width !== sizedWidth || height !== sizedHeight) {
      gpu.setSize(width, height);
      sizedWidth = width;
      sizedHeight = height;
    }
    const vertical = span / zoom,
      horizontal = (vertical * width) / height;
    camera.left = -horizontal / 2;
    camera.right = horizontal / 2;
    camera.top = vertical / 2;
    camera.bottom = -vertical / 2;
    camera.position
      .copy(target)
      .add(
        new Vector3(
          Math.sin(yaw) * Math.cos(pitch),
          Math.sin(pitch),
          Math.cos(yaw) * Math.cos(pitch),
        ).multiplyScalar(100),
      );
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    invalidate();
  }
  return {
    camera,
    resize: update,
    fit(bounds, object) {
      bounds.getCenter(target);
      const size = bounds.getSize(new Vector3()),
        ratio = host.clientWidth / Math.max(1, host.clientHeight);
      span = Math.max(
        options.minSpan ?? 2,
        size.length() * 1.14,
        (size.x + size.z) / Math.max(0.4, ratio),
      );
      if (options.projectedFit) {
        const width =
          Math.abs(Math.cos(yaw)) * size.x + Math.abs(Math.sin(yaw)) * size.z;
        const height =
          Math.abs(Math.sin(yaw) * Math.sin(pitch)) * size.x +
          Math.abs(Math.cos(pitch)) * size.y +
          Math.abs(Math.cos(yaw) * Math.sin(pitch)) * size.z;
        span = Math.max(0.01, height, width / Math.max(0.1, ratio)) * 1.12;
        if (object) {
          const right = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
          const up = new Vector3(
            -Math.sin(yaw) * Math.sin(pitch),
            Math.cos(pitch),
            -Math.cos(yaw) * Math.sin(pitch),
          );
          const point = new Vector3();
          let left = Infinity,
            rightmost = -Infinity,
            bottom = Infinity,
            top = -Infinity;
          object.traverse((node) => {
            const position =
              node.isMesh && node.geometry.getAttribute("position");
            if (!position) return;
            for (let i = 0; i < position.count; i++) {
              point
                .fromBufferAttribute(position, i)
                .applyMatrix4(node.matrixWorld);
              const x = point.dot(right),
                y = point.dot(up);
              left = Math.min(left, x);
              rightmost = Math.max(rightmost, x);
              bottom = Math.min(bottom, y);
              top = Math.max(top, y);
            }
          });
          if (Number.isFinite(left)) {
            target.addScaledVector(
              right,
              (left + rightmost) / 2 - target.dot(right),
            );
            target.addScaledVector(up, (bottom + top) / 2 - target.dot(up));
            span =
              Math.max(
                0.01,
                top - bottom,
                (rightmost - left) / Math.max(0.1, ratio),
              ) * 1.12;
          }
        }
      }
      zoom = 1;
      update();
    },
    rotate(dx, dy) {
      yaw -= dx * 0.007;
      pitch = Math.max(
        options.minPitch ?? 0.12,
        Math.min(Math.PI / 2 - 0.01, pitch + dy * 0.007),
      );
      update();
    },
    zoom(delta) {
      zoom = Math.max(0.25, Math.min(6, zoom * Math.exp(-delta * 0.001)));
      update();
    },
    ray(event) {
      const r = host.getBoundingClientRect();
      ray.setFromCamera(
        new Vector2(
          ((event.clientX - r.left) / r.width) * 2 - 1,
          1 - ((event.clientY - r.top) / r.height) * 2,
        ),
        camera,
      );
      return ray;
    },
    project(position) {
      const p = new Vector3(...position).project(camera);
      return {
        x: ((p.x + 1) * host.clientWidth) / 2,
        y: ((1 - p.y) * host.clientHeight) / 2,
      };
    },
    view: () => ({ yaw, pitch, zoom }),
  };
}
