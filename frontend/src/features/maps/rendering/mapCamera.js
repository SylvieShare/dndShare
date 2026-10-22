import { Plane, Raycaster, Vector2, Vector3 } from "three";
import { FLOOR } from "./annotations";
import { renderPixelRatio } from "./renderQuality";
import { applySceneCamera } from "./sceneCameraView";

export const ISOMETRIC_TILT = (Math.atan(1 / Math.sqrt(2)) * 180) / Math.PI;
export const ISOMETRIC_AZIMUTH = 45;

export function mapCamera(camera, gpu, host, render) {
  let document,
    view = {
      x: 10,
      y: 7,
      cellPixels: 48,
      rotation: 0,
      fit: true,
      tilt: ISOMETRIC_TILT,
      azimuth: ISOMETRIC_AZIMUTH,
    },
    readonly = false,
    sizedWidth = 0,
    sizedHeight = 0,
    sceneHeight = 1;
  const ray = new Raycaster(),
    point = new Vector3(),
    plane = new Plane(new Vector3(0, 1, 0), -FLOOR);
  ray.firstHitOnly = true;
  function update(next = view) {
    view = { ...view, ...next };
    const width = host.clientWidth || 1,
      height = host.clientHeight || 1;
    const pitch = ((readonly ? 90 : view.tilt) * Math.PI) / 180;
    const yaw =
      ((readonly ? view.rotation : (view.azimuth ?? view.rotation)) * Math.PI) /
      180;
    let pixels = view.cellPixels;
    if (document && view.fit) {
      view.elevation = FLOOR;
      view.x = document.width / 2;
      view.y = document.height / 2;
      const c = Math.abs(Math.cos(yaw)),
        s = Math.abs(Math.sin(yaw));
      pixels = Math.min(
        (width - 40) / (c * document.width + s * document.height),
        (height - 40) /
          ((s * document.width + c * document.height) * Math.sin(pitch) +
            2 * Math.max(1, sceneHeight) * Math.cos(pitch)),
      );
    }
    pixels = Math.max(0.5, pixels);
    view.cellPixels = pixels;
    const ratio = renderPixelRatio(width, height);
    if (
      width !== sizedWidth ||
      height !== sizedHeight ||
      (gpu.getPixelRatio && gpu.getPixelRatio() !== ratio)
    ) {
      gpu.setPixelRatio?.(ratio);
      gpu.setSize(width, height);
      sizedWidth = width;
      sizedHeight = height;
    }
    camera.near = 0.01;
    camera.far = 2000;
    camera.left = -width / 2 / pixels;
    camera.right = width / 2 / pixels;
    camera.top = height / 2 / pixels;
    camera.bottom = -height / 2 / pixels;
    camera.position.set(
      view.x + Math.sin(yaw) * Math.cos(pitch) * 500,
      (view.elevation ?? FLOOR) + Math.sin(pitch) * 500,
      view.y + Math.cos(yaw) * Math.cos(pitch) * 500,
    );
    camera.up.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    if (pitch < 0 && Math.abs(Math.cos(pitch)) > 1e-8) camera.up.negate();
    camera.lookAt(view.x, view.elevation ?? FLOOR, view.y);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    if (view.view) {
      applySceneCamera(camera, view.view);
      view.cellPixels = width / view.view.width;
    }
    render();
  }
  function cast(event) {
    const r = gpu.domElement.getBoundingClientRect();
    ray.setFromCamera(
      new Vector2(
        ((event.clientX - r.left) / r.width) * 2 - 1,
        1 - ((event.clientY - r.top) / r.height) * 2,
      ),
      camera,
    );
    return ray;
  }
  return {
    update,
    document(d, options) {
      document = d;
      if (options.sceneHeight !== undefined)
        sceneHeight = options.sceneHeight || 1;
      readonly = !!options.tabletop || d.kind === "image";
      update();
    },
    world(event, elevation = FLOOR) {
      plane.constant = -elevation;
      const result = cast(event).ray.intersectPlane(plane, point);
      return result ? { x: result.x, y: result.z } : { x: -1, y: -1 };
    },
    ray: cast,
    project(point) {
      const p = point.clone().project(camera);
      return {
        x: ((p.x + 1) * host.clientWidth) / 2,
        y: ((1 - p.y) * host.clientHeight) / 2,
      };
    },
    getView: () => ({
      ...view,
      ...(readonly ? { tilt: 90, azimuth: view.rotation } : {}),
    }),
    capture: () =>
      view.view
        ? structuredClone(view.view)
        : {
            position: [camera.position.x, camera.position.z, camera.position.y],
            target: [view.x, view.y, view.elevation ?? FLOOR],
            up: [camera.up.x, camera.up.z, camera.up.y],
            width: camera.right - camera.left,
            aspect: (camera.right - camera.left) / (camera.top - camera.bottom),
          },
  };
}
