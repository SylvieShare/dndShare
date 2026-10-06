import { syncSurfaceObjects } from "../lib/surfacePlacement";
import { pruneAreas } from "../lib/mapAreas";
import { editorAreas } from "./editorAreas";
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from "vue";
import { getMapModels, resetMapModels, saveMap } from "@/shared/api/mapsApi";
import { clone, newMap, resized, uid } from "../lib/mapModel";
import { editorGestures } from "./editorGestures";
import { editorTileDrag } from "./editorTileDrag";
import { editorWallBrush } from "./editorWallBrush";

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
  const selectedZone = ref(""),
    selectedObject = ref(""),
    selectedObjects = ref([]),
    selection = ref(null),
    saving = ref(false),
    error = ref(""),
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
  }
  function undo() {
    if (!history.value.length) return;
    future.value.push(clone(draft.value));
    draft.value = history.value.pop();
    gestures.resetGesture();
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
      conflict.value ||
      !dirty.value ||
      !draft.value.name.trim() ||
      (draft.value.document.kind !== "tiles" &&
        !draft.value.document.background.url)
    )
      return;
    saving.value = true;
    error.value = "";
    syncSurfaceObjects(draft.value.document, catalogue.value);
    pruneAreas(draft.value.document);
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
      onSaved?.(result);
    } catch (cause) {
      error.value = cause.message;
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
    { deep: true },
  );
  function resize(width, height) {
    change((m) => {
      m.document = resized(m.document, width, height);
    });
  }
  function addZone() {
    const z = {
      id: uid(),
      name: `Зона ${draft.value.document.zones.length + 1}`,
      cells: [],
      rects: [],
    };
    change((m) => m.document.zones.push(z));
    selectedZone.value = z.id;
    tool.value = "zone";
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
    selectedZone,
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
  const wallBrush = editorWallBrush(state);
  const gestures = editorGestures({ ...state, tileDrag, wallBrush });
  async function loadModels() {
    loadingModels.value = true;
    modelError.value = "";
    try {
      catalogue.value = await getMapModels();
      if (!selectedModel.value)
        selectedModel.value =
          catalogue.value.find((m) => m.sourceCode === "LC-007")?.id ||
          catalogue.value[0]?.id ||
          "";
    } catch (cause) {
      modelError.value = cause.message;
    } finally {
      loadingModels.value = false;
    }
  }
  function retryModels() {
    resetMapModels();
    return loadModels();
  }
  onMounted(loadModels);
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
    wallBrush,
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
    selectedZone,
    selectedObject,
    selectedObjects,
    setObjectSelection,
    selection,
    saving,
    error,
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
    addZone,
    ...editorAreas(state),
    ...gestures,
  };
}
