// Orthographic framing depends on direction, target and size, not eye distance.
// Keep editable camera markers near their target instead of the editor's distant eye.
export function cameraFromEditor(view) {
  const result = JSON.parse(JSON.stringify(view));
  const delta = view.position.map((n, i) => n - view.target[i]);
  const length = Math.hypot(...delta);
  const distance = Math.min(6, Math.max(1, view.width / 4));
  result.position = view.target.map(
    (n, i) => n + (delta[i] * distance) / length,
  );
  return result;
}
export function translatedCamera(camera, origin, point) {
  const dx = point.x - origin.x,
    dy = point.y - origin.y;
  return {
    ...camera,
    view: {
      ...camera.view,
      position: [
        camera.view.position[0] + dx,
        camera.view.position[1] + dy,
        camera.view.position[2],
      ],
      target: [
        camera.view.target[0] + dx,
        camera.view.target[1] + dy,
        camera.view.target[2],
      ],
    },
  };
}
