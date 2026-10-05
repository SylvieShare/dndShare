import { Plane, Raycaster, Vector2, Vector3 } from "three";
import { FLOOR } from "./annotations";

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
    sizedHeight = 0;
  const ray = new Raycaster(),
    point = new Vector3(),
    plane = new Plane(new Vector3(0, 1, 0), -FLOOR);
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
      view.x = document.width / 2;
      view.y = document.height / 2;
      const c = Math.abs(Math.cos(yaw)),
        s = Math.abs(Math.sin(yaw));
      pixels = Math.min(
        (width - 40) / (c * document.width + s * document.height),
        (height - 40) /
          ((s * document.width + c * document.height) * Math.sin(pitch) +
            2 * Math.cos(pitch)),
      );
    }
    pixels = Math.max(0.5, pixels);
    view.cellPixels = pixels;
    if (width !== sizedWidth || height !== sizedHeight) {
      gpu.setSize(width, height);
      sizedWidth = width;
      sizedHeight = height;
    }
    camera.left = -width / 2 / pixels;
    camera.right = width / 2 / pixels;
    camera.top = height / 2 / pixels;
    camera.bottom = -height / 2 / pixels;
    camera.position.set(
      view.x + Math.sin(yaw) * Math.cos(pitch) * 500,
      FLOOR + Math.sin(pitch) * 500,
      view.y + Math.cos(yaw) * Math.cos(pitch) * 500,
    );
    camera.up.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    camera.lookAt(view.x, FLOOR, view.y);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
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
      readonly = !!options.tabletop || d.kind !== "tiles";
      update();
    },
    world(event) {
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
    getView: () => ({ ...view }),
  };
}
