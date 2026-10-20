import { useEditorSelection } from "./useEditorSelection";
import { useMapPersistence } from "./useMapPersistence";
import { startModelRefresh } from "../lib/currentModelRefresh";
import { useEditorJournal } from "./useEditorJournal";
import { documentIndex } from "../lib/documentIndex";
import { structureContext } from "../lib/tileStructure";
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
import { getMapModels, resetMapModels } from "@/shared/api/mapsApi";
import { clone, newMap, resized } from "../lib/mapModel";
import { editorGestures } from "./editorGestures";
import { editorTileDrag } from "./editorTileDrag";

export function useMapEditor(source, onSaved, options = {}) {
  const draft = ref(clone(source || newMap())),
    tool = ref("select"),
    selectedModel = ref(""),
    placementRotation = ref(0),
    placementHint = ref(null),
    collection = ref("lost-cave"),
    screenSelection = ref(null),
    hoveredTile = ref(""),
    hoveredObject = ref(""),
    draggingTile = ref(false),
    previewTile = ref(null),
    previewObject = ref(null),
    showAnchors = ref(true),
    catalogue = shallowRef([]),
    modelMemory = shallowRef(null),
    loadingModels = ref(true),
    modelError = ref(""),
    objectKind = ref("chest"),
    objectModel = ref("");
  const selection = ref(null),
    gesturing = ref(false);
  const {
    selectedTile,
    selectedTiles,
    selectedObject,
    selectedObjects,
    setTileSelection,
    setObjectSelection,
  } = useEditorSelection();
  const journal = useEditorJournal(draft, !!source?.id);
  const { history, future, dirty } = journal;
  const checkpoint = journal.checkpoint;
  const {
    saving,
    error,
    saveError,
    conflict,
    lastSavedAt,
    save,
    receive,
    pauseSave,
  } = useMapPersistence({
    draft,
    journal,
    catalogue,
    loadingModels,
    gesturing,
    options,
    onSaved,
    source,
    finishLightEdit: () => lighting.finishLightEdit(),
  });
  function change(fn) {
    lighting.finishLightEdit();
    checkpoint();
    try {
      fn(draft.value);
      pruneAreas(draft.value.document);
      if (catalogue.value.length)
        syncLights(draft.value.document, catalogue.value);
      journal.commit();
    } catch (cause) {
      journal.rollback();
      throw cause;
    }
  }
  function undo() {
    lighting.finishLightEdit();
    if (!journal.undo()) return;
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
    lighting.finishLightEdit();
    if (!journal.redo()) return;
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
  function resize(width, height) {
    change((m) => {
      m.document = resized(m.document, width, height);
    });
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
    commitEdit: journal.commit,
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
      if (!selectedModel.value) {
        collection.value =
          catalogue.value.find(
            (m) => m.id === draft.value.document.tiles[0]?.modelId,
          )?.collection || collection.value;
        selectedModel.value =
          catalogue.value.find((m) => m.sourceCode === "LC-007")?.id ||
          catalogue.value[0]?.id ||
          "";
      }
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
  let stopModelRefresh;
  onMounted(() => {
    loadModels();
    stopModelRefresh = startModelRefresh(
      () =>
        gesturing.value || options.active?.() === false ? null : getMapModels(),
      (models) => {
        if (JSON.stringify(models) !== JSON.stringify(catalogue.value))
          catalogue.value = models;
      },
    );
  });
  watch(catalogue, () => {
    if (catalogue.value.length)
      syncLights(draft.value.document, catalogue.value);
  });
  onBeforeUnmount(() => {
    stopModelRefresh?.();
    lighting.finishLightEdit();
  });
  return {
    draft,
    documentIndex: computed(() =>
      documentIndex(
        draft.value.document,
        catalogue.value,
        structureContext(draft.value.document, catalogue.value),
      ),
    ),
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
    modelMemory,
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
    gesturing,
    receive,
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
      if (areas.handleMembership(event)) return;
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
