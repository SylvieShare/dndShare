export function mapOverview(display, map) {
  return {
    ...display.camera,
    sceneId: "",
    view: null,
    fit: true,
    x: map.document.width / 2,
    y: map.document.height / 2,
  };
}
export function toggleMapBroadcast(display, map) {
  if (display.mapId === map.id)
    return { mapId: map.id, visible: !display.visible };
  return { mapId: map.id, visible: true, camera: mapOverview(display, map) };
}
