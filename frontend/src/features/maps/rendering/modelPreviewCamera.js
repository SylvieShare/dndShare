import { OrthographicCamera, Raycaster, Vector2, Vector3 } from "three";

export function modelPreviewCamera(gpu, host, invalidate) {
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.01, 2000);
  const target = new Vector3(),
    ray = new Raycaster();
  let yaw = Math.PI / 4,
    pitch = Math.atan(1 / Math.sqrt(2)),
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
    fit(bounds) {
      bounds.getCenter(target);
      const size = bounds.getSize(new Vector3()),
        ratio = host.clientWidth / Math.max(1, host.clientHeight);
      span = Math.max(
        2,
        size.length() * 1.14,
        (size.x + size.z) / Math.max(0.4, ratio),
      );
      zoom = 1;
      update();
    },
    rotate(dx, dy) {
      yaw -= dx * 0.007;
      pitch = Math.max(0.12, Math.min(Math.PI / 2 - 0.01, pitch + dy * 0.007));
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
