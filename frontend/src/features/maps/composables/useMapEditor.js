import { editorDecals } from "./editorDecals";
import { canonicalMapData } from "@/shared/api/mapDocumentData";
import { pruneDecals } from "../lib/mapDecals";
import { useEditorSelection } from "./useEditorSelection";
import { useMapPersistence } from "./useMapPersistence";
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
  const draft = ref(canonicalMapData(clone(source || newMap()))),
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
    modelCatalogueRequest = shallowRef(null),
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
    reload,
    discard,
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
    finishLightEdit: () => {
      lighting.finishLightEdit();
      decals.finishDecalEdit();
    },
  });
  function change(fn) {
    lighting.finishLightEdit();
    decals.finishDecalEdit();
    checkpoint();
    try {
      fn(draft.value);
      draft.value.document = canonicalMapData(draft.value).document;
      pruneAreas(draft.value.document);
      pruneDecals(draft.value.document);
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
    decals.finishDecalEdit();
    if (!journal.undo()) {
      if (journal.conflict.value) error.value = journal.conflict.value.message;
      return;
    }
    gestures.resetGesture();
    lighting.reset();
    decals.reset();
    decals.selectedDecal.value = "";
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
    decals.finishDecalEdit();
    if (!journal.redo()) {
      if (journal.conflict.value) error.value = journal.conflict.value.message;
      return;
    }
    gestures.resetGesture();
    lighting.reset();
    decals.reset();
    decals.selectedDecal.value = "";
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
  const decals = editorDecals({
    ...state,
    selectedLight: lighting.selectedLight,
    clearAreaFocus: () => areas.clearAreaFocus(),
    finishOtherEdit: lighting.finishLightEdit,
  });
  const areas = editorAreas({
    ...state,
    selectedLight: lighting.selectedLight,
  });
  watch(
    [selectedTiles, selectedObjects, lighting.selectedLight],
    () => {
      if (
        selectedTiles.value.length ||
        selectedObjects.value.length ||
        lighting.selectedLight.value
      )
        decals.selectedDecal.value = "";
      if (selectedTiles.value.length || selectedObjects.value.length)
        lighting.selectedLight.value = "";
    },
    { deep: true },
  );
  const catalogueAbort = new AbortController();
  async function loadModels() {
    if (draft.value.document.kind === "image") {
      catalogue.value = [];
      loadingModels.value = false;
      return;
    }
    loadingModels.value = true;
    modelError.value = "";
    try {
      catalogue.value = await getMapModels(undefined, {
        signal: catalogueAbort.signal,
        onRequest: (file) => (modelCatalogueRequest.value = file),
      });
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
      if (cause.name !== "AbortError") modelError.value = cause;
    } finally {
      loadingModels.value = false;
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
  onBeforeUnmount(() => {
    catalogueAbort.abort();
    lighting.finishLightEdit();
    decals.finishDecalEdit();
  });
  return {
    modelCatalogueRequest,
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
    reload,
    discard,
    pauseSave,
    change,
    undo,
    redo,
    resize,
    ...areas,
    ...editorTransitions(state),
    ...gestures,
    ...lighting,
    selectedDecal: decals.selectedDecal,
    hoveredDecal: decals.hoveredDecal,
    removeDecal: decals.remove,
    previewDecal: decals.previewDecal,
    copiedDecal: decals.copiedDecal,
    beginDecal: decals.beginDecal,
    moveDecal: decals.moveDecal,
    selectDecal: decals.selectDecal,
    updateDecal: decals.updateDecal,
    finishDecalEdit: decals.finishDecalEdit,
    rotate() {
      if (!decals.rotate()) gestures.rotate();
    },
    lightDrag: lighting.driver,
    copy() {
      if (decals.copy()) {
        lighting.copiedLight.value = null;
        return;
      }
      decals.copiedDecal.value = null;
      if (lighting.copyLight()) return;
      if (gestures.copy()) lighting.copiedLight.value = null;
    },
    handle(event) {
      if (decals.handle(event)) return;
      if (areas.handleMembership(event)) return;
      if (event.phase === "start" || event.phase === "cancel")
        areas.clearAreaFocus(event.phase === "cancel");
      if (lighting.handle(event)) return;
      if (event.phase === "start") lighting.selectedLight.value = "";
      gestures.handle(event);
    },
    resetGesture() {
      lighting.reset();
      decals.reset();
      decals.selectedDecal.value = "";
      lighting.driver.cancel();
      gestures.resetGesture();
    },
    removeSelected() {
      if (decals.remove()) return;
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
