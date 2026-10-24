import { computed, onBeforeUnmount } from "vue";
export function useSessionMapBroadcast(
  controller,
  workspace,
  prepareLeave,
  select,
) {
  const c = controller;
  let stopped = false;
  onBeforeUnmount(() => {
    stopped = true;
  });
  const broadcastView = computed(() =>
    c.display?.mapId === c.selectedID && !c.display.camera.sceneId
      ? c.display.camera.view
      : null,
  );
  async function source(id) {
    const mapId = c.selectedID;
    if (!(await prepareLeave()) || c.selectedID !== mapId) return;
    const camera = c.selected.document.cameras?.find((item) => item.id === id);
    if (!camera) return;
    c.updateDisplay({
      mapId,
      camera: {
        ...c.display.camera,
        fit: false,
        sceneId: camera.id,
        view: camera.view,
      },
    });
  }
  async function capture() {
    const mapId = c.selectedID,
      view = workspace.value?.canvas?.captureCamera();
    if (view && (await prepareLeave()) && c.selectedID === mapId)
      c.updateDisplay({
        mapId,
        camera: { ...c.display.camera, fit: false, sceneId: "", view },
      });
  }
  async function showBroadcastView() {
    const id = c.display?.mapId;
    if (!id || !c.maps.some((map) => map.id === id) || !(await select(id)))
      return;
    const camera = c.display?.camera;
    const draft = workspace.value?.editor?.draft;
    const document = (draft?.id === id ? draft : c.selected).document;
    const saved = document.cameras?.find((item) => item.id === camera?.sceneId);
    const view = saved?.view || camera?.view;
    for (
      let frame = 0;
      frame < 120 && !stopped && c.selectedID === id;
      frame++
    ) {
      const canvas = workspace.value?.canvas;
      if (workspace.value?.editor?.draft.id === id && canvas?.getView()) {
        if (view) canvas.lookThrough(view);
        else canvas.fit();
        return;
      }
      await new Promise(requestAnimationFrame);
    }
  }
  return { broadcastView, source, capture, showBroadcastView };
}
