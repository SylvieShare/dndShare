import { Vector3 } from "three";
export const worldVector = ([x, y, z]) => new Vector3(x, z, y);
export function applySceneCamera(camera, view) {
  // Orthographic rays remain parallel behind the marker as well. The editable
  // eye is near the focus, while the whole map must retain the captured framing.
  camera.near = -500;
  camera.far = 2000;
  camera.position.copy(worldVector(view.position));
  camera.up.copy(worldVector(view.up));
  camera.lookAt(worldVector(view.target));
  camera.left = -view.width / 2;
  camera.right = view.width / 2;
  camera.top = view.width / view.aspect / 2;
  camera.bottom = -camera.top;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
}
export function cameraFrame(view) {
  const position = worldVector(view.position),
    target = worldVector(view.target),
    direction = target.clone().sub(position).normalize();
  const right = direction.clone().cross(worldVector(view.up)).normalize(),
    up = right.clone().cross(direction).normalize();
  return [-1, 1].flatMap((x) =>
    [-1, 1].map((y) =>
      target
        .clone()
        .addScaledVector(right, (x * view.width) / 2)
        .addScaledVector(up, (y * view.width) / view.aspect / 2),
    ),
  );
}

// Return to ordinary editor controls after visiting a saved orthographic pose.
export function editorViewFromScene(view, viewportWidth) {
  const delta = view.position.map((n, i) => n - view.target[i]);
  const horizontal = Math.hypot(delta[0], delta[1]);
  return {
    x: view.target[0],
    y: view.target[1],
    elevation: view.target[2],
    azimuth:
      (Math.atan2(
        ...(horizontal > 1e-8
          ? [delta[0], delta[1]]
          : [-view.up[0], -view.up[1]]),
      ) *
        180) /
      Math.PI,
    tilt: (Math.atan2(delta[2], horizontal) * 180) / Math.PI,
    cellPixels: viewportWidth / view.width,
    view: null,
    fit: false,
  };
}
