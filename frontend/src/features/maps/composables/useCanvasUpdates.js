import { onMounted, onBeforeUnmount, watch } from "vue";
import { useMapRenderSettings } from "./useMapRenderSettings";

export function useCanvasUpdates(props, getRenderer, onError, onActive) {
  const { forceLod } = useMapRenderSettings();
  const options = () => ({
    ...props,
    forceLod: props.forceLod || forceLod.value,
  });
  let frame = 0;
  const pendingChanges = new Set();
  function redraw(change = "structure") {
    pendingChanges.add(change);
    if (frame || !getRenderer() || !props.active || window.document.hidden)
      return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const sceneChanges = [...pendingChanges];
      pendingChanges.clear();
      getRenderer()
        .update(props.document, props.state, { ...options(), sceneChanges })
        .catch((cause) => {
          onError(cause);
        });
    });
  }
  function syncActive(refresh = true) {
    const active = props.active && !window.document.hidden;
    getRenderer()?.setActive(active);
    onActive(active);
    if (active && refresh) redraw();
    else {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  }
  watch(
    () => props.active,
    () => syncActive(),
  );
  watch(forceLod, () => redraw("quality"));
  watch(
    () => [
      props.document.tiles,
      props.document.image,
      props.document.width,
      props.document.height,
      props.catalogue,
      props.catalogueRequest,
    ],
    () => redraw("structure"),
    { deep: true },
  );
  watch(
    () => [props.document.cameras, props.broadcastView, props.previewCamera],
    () => getRenderer()?.updateCameras(props.document, options()),
    { deep: true },
  );
  watch(
    () => [props.document.objects, props.document.decals, props.state],
    () => redraw("entities"),
    { deep: true },
  );
  watch(
    () => [
      props.document.lights,
      props.document.sun,
      props.document.lightingEnabled,
    ],
    () => redraw("lighting"),
    { deep: true },
  );
  watch(
    () => [
      props.document.areas,
      props.document.zones,
      props.document.grid,
      props.master,
      props.areaMode,
    ],
    () => redraw("visibility"),
    { deep: true },
  );
  watch(
    () => [
      props.previewTile,
      props.previewObject,
      props.placementObject,
      props.surfacePlacement,
      props.previewLight,
      props.previewDecal,
      props.showAnchors,
    ],
    () => redraw("preview"),
    { deep: true },
  );
  watch(
    () => [
      props.selectedZone,
      props.showZones,
      props.selection,
      props.selectedObject,
      props.selectedObjects,
      props.selectedToken,
      props.selectedTile,
      props.selectedTiles,
      props.hoveredTile,
      props.hoveredObject,
      props.selectedLight,
      props.selectedCamera,
      props.hoveredCamera,
      props.hoveredCameraPart,
      props.draggingCameraPart,
      props.editCameras,
      props.selectedDecal,
      props.hoveredDecal,
      props.hoveredLight,
      props.editLights,
      props.selectionColor,
    ],
    () => getRenderer()?.updateSelection(options()),
    { deep: true },
  );
  watch(
    () => props.camera,
    (c) => {
      if (c) getRenderer()?.camera(c);
    },
    { deep: true },
  );
  const visibilityChanged = () => syncActive();
  onMounted(() =>
    window.document.addEventListener("visibilitychange", visibilityChanged),
  );
  onBeforeUnmount(() => {
    cancelAnimationFrame(frame);
    window.document.removeEventListener("visibilitychange", visibilityChanged);
  });
  return { redraw, syncActive, options };
}
