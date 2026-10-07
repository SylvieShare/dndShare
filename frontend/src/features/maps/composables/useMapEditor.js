import { syncSurfaceObjects } from "../lib/surfacePlacement";
import { pruneAreas } from "../lib/mapAreas";
import { editorAreas } from "./editorAreas";
import { editorLighting } from "./editorLighting";
import { editorTransitions } from "./editorTransitions";
import { syncLights } from "../lib/mapLighting";
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from "vue";
import { getMapModels, resetMapModels, saveMap } from "@/shared/api/mapsApi";
import { clone, newMap, resized } from "../lib/mapModel";
import { editorGestures } from "./editorGestures";
import { editorTileDrag } from "./editorTileDrag";

export function useMapEditor(source, onSaved) {
  const draft = ref(clone(source || newMap())),
    tool = ref("select"),
    selectedModel = ref(""),
    placementRotation = ref(0),
    placementHint = ref(null),
    collection = ref("lost-cave"),
    selectedTile = ref(""),
    selectedTiles = ref([]),
    screenSelection = ref(null),
    hoveredTile = ref(""),
    hoveredObject = ref(""),
    draggingTile = ref(false),
    previewTile = ref(null),
    previewObject = ref(null),
    showAnchors = ref(true),
    catalogue = shallowRef([]),
    loadingModels = ref(true),
    modelError = ref(""),
    objectKind = ref("chest"),
    objectModel = ref("");
  const selectedObject = ref(""),
    selectedObjects = ref([]),
    selection = ref(null),
    saving = ref(false),
    error = ref(""),
    saveError = ref(""),
    lastSavedAt = ref(source?.system ? null : source?.changedAt || null),
    conflict = ref(false);
  const history = ref([]),
    future = ref([]),
    saved = ref(
      source?.id && !source.system ? JSON.stringify(draft.value) : "",
    );
  let timer,
    inGesture = false,
    stopped = false;
  if (draft.value.system) {
    delete draft.value.id;
    draft.value.system = false;
    draft.value.name += " · копия";
    draft.value.revision = 0;
  }
  const dirty = computed(() => JSON.stringify(draft.value) !== saved.value);
  function setTileSelection(ids, primary = ids[0] || "") {
    selectedTiles.value = [...new Set(ids)];
    selectedTile.value = primary;
  }
  function checkpoint() {
    history.value.push(clone(draft.value));
    if (history.value.length > 50) history.value.shift();
    future.value = [];
  }
  function setObjectSelection(ids) {
    selectedObjects.value = [...new Set(ids)];
    selectedObject.value = selectedObjects.value[0] || "";
  }
  function change(fn) {
    checkpoint();
    fn(draft.value);
    pruneAreas(draft.value.document);
    if (catalogue.value.length)
      syncLights(draft.value.document, catalogue.value);
  }
  function undo() {
    if (!history.value.length) return;
    future.value.push(clone(draft.value));
    draft.value = history.value.pop();
    gestures.resetGesture();
    lighting.reset();
    lighting.driver.cancel();
    setTileSelection(
      selectedTiles.value.filter((id) =>
        draft.value.document.tiles.some((t) => t.id === id),
      ),
    );
    selection.value = null;
    setObjectSelection(
      selectedObjects.value.filter((id) =>
        draft.value.document.objects.some((o) => o.id === id),
      ),
    );
  }
  function redo() {
    if (!future.value.length) return;
    history.value.push(clone(draft.value));
    draft.value = future.value.pop();
    gestures.resetGesture();
    lighting.reset();
    lighting.driver.cancel();
    setTileSelection(
      selectedTiles.value.filter((id) =>
        draft.value.document.tiles.some((t) => t.id === id),
      ),
    );
    selection.value = null;
    setObjectSelection(
      selectedObjects.value.filter((id) =>
        draft.value.document.objects.some((o) => o.id === id),
      ),
    );
  }
  // Document history never rolls the server's compare-and-swap version back.
  let record = { id: draft.value.id, revision: draft.value.revision };
  async function save() {
    clearTimeout(timer);
    if (
      saving.value ||
      loadingModels.value ||
      conflict.value ||
      !dirty.value ||
      !draft.value.name.trim() ||
      (draft.value.document.kind !== "tiles" &&
        !draft.value.document.background.url)
    )
      return;
    saving.value = true;
    error.value = "";
    saveError.value = "";
    syncSurfaceObjects(draft.value.document, catalogue.value);
    pruneAreas(draft.value.document);
    syncLights(draft.value.document, catalogue.value);
    const snapshot = { ...clone(draft.value), ...record },
      key = JSON.stringify(snapshot);
    try {
      const result = await saveMap(snapshot);
      record = { id: result.id, revision: result.revision };
      draft.value.id = result.id;
      draft.value.revision = result.revision;
      // Only acknowledge the exact payload, keeping edits made during the request dirty.
      saved.value = JSON.stringify({
        ...JSON.parse(key),
        id: result.id,
        revision: result.revision,
      });
      lastSavedAt.value = result.changedAt;
      onSaved?.(result);
    } catch (cause) {
      error.value = cause.message;
      saveError.value = cause.message;
      conflict.value = cause.status === 409;
    } finally {
      saving.value = false;
      if (dirty.value && !error.value && !stopped)
        timer = setTimeout(save, 800);
    }
  }
  watch(
    draft,
    () => {
      clearTimeout(timer);
      if (!inGesture && !conflict.value) timer = setTimeout(save, 1200);
    },
    { deep: true, immediate: true },
  );
  function resize(width, height) {
    change((m) => {
      m.document = resized(m.document, width, height);
    });
  }
  function pauseSave(value) {
    inGesture = value;
    clearTimeout(timer);
    if (!value && !conflict.value && !stopped) timer = setTimeout(save, 1200);
  }
  const state = {
    draft,
    tool,
    selectedModel,
    placementRotation,
    placementHint,
    objectKind,
    objectModel,
    selectedTile,
    selectedTiles,
    screenSelection,
    setTileSelection,
    hoveredTile,
    hoveredObject,
    draggingTile,
    previewTile,
    previewObject,
    showAnchors,
    selectedObject,
    selectedObjects,
    setObjectSelection,
    selection,
    history,
    error,
    checkpoint,
    change,
    pauseSave,
    catalogue,
    collection,
  };
  const tileDrag = editorTileDrag(state);
  const gestures = editorGestures({ ...state, tileDrag });
  const lighting = editorLighting(state);
  const areas = editorAreas({
    ...state,
    selectedLight: lighting.selectedLight,
  });
  watch(
    [selectedTiles, selectedObjects],
    () => {
      if (selectedTiles.value.length || selectedObjects.value.length)
        lighting.selectedLight.value = "";
    },
    { deep: true },
  );
  async function loadModels() {
    loadingModels.value = true;
    modelError.value = "";
    try {
      catalogue.value = await getMapModels();
      syncLights(draft.value.document, catalogue.value);
      if (!selectedModel.value)
        selectedModel.value =
          catalogue.value.find((m) => m.sourceCode === "LC-007")?.id ||
          catalogue.value[0]?.id ||
          "";
    } catch (cause) {
      modelError.value = cause.message;
    } finally {
      loadingModels.value = false;
      if (dirty.value && !inGesture && !conflict.value && !stopped) {
        clearTimeout(timer);
        timer = setTimeout(save, 1200);
      }
    }
  }
  function retryModels() {
    resetMapModels();
    return loadModels();
  }
  onMounted(loadModels);
  watch(catalogue, () => {
    if (catalogue.value.length)
      syncLights(draft.value.document, catalogue.value);
  });
  function beforeUnload(e) {
    if (dirty.value) {
      e.preventDefault();
      e.returnValue = "";
    }
  }
  window.addEventListener("beforeunload", beforeUnload);
  onBeforeUnmount(() => {
    stopped = true;
    clearTimeout(timer);
    window.removeEventListener("beforeunload", beforeUnload);
    lighting.finishLightEdit();
  });
  return {
    draft,
    tool,
    selectedModel,
    placementRotation,
    placementHint,
    selectedTile,
    selectedTiles,
    screenSelection,
    setTileSelection,
    hoveredTile,
    hoveredObject,
    draggingTile,
    tileDrag,
    previewTile,
    previewObject,
    showAnchors,
    catalogue,
    collection,
    loadingModels,
    modelError,
    retryModels,
    objectKind,
    objectModel,
    selectedObject,
    selectedObjects,
    setObjectSelection,
    selection,
    saving,
    error,
    saveError,
    lastSavedAt,
    conflict,
    dirty,
    history,
    future,
    save,
    pauseSave,
    change,
    undo,
    redo,
    resize,
    ...areas,
    ...editorTransitions(state),
    ...gestures,
    ...lighting,
    lightDrag: lighting.driver,
    copy() {
      if (lighting.copyLight()) return;
      if (gestures.copy()) lighting.copiedLight.value = null;
    },
    handle(event) {
      if (event.phase === "start" || event.phase === "cancel")
        areas.clearAreaFocus(event.phase === "cancel");
      if (lighting.handle(event)) return;
      if (event.phase === "start") lighting.selectedLight.value = "";
      gestures.handle(event);
    },
    resetGesture() {
      lighting.reset();
      lighting.driver.cancel();
      gestures.resetGesture();
    },
    removeSelected() {
      if (areas.focusedArea.value) {
        areas.removeArea(areas.focusedArea.value);
        return;
      }
      lighting.selectedLight.value
        ? lighting.removeLight()
        : gestures.removeSelected();
    },
  };
}
