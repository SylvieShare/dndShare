import { computed, ref, watch } from "vue";
import { saveMapModelMetadata } from "@/shared/api/mapsApi";
import { modelMetadata } from "../lib/modelMetadata";
import { visibleModels } from "../lib/visibleModels";
export function useModelReference(editor) {
  const base = ref(null),
    draft = ref(null),
    behaviour = ref(null),
    baseBehaviour = ref(null),
    kind = ref("tile"),
    blockers = ref(""),
    error = ref(""),
    saving = ref(false),
    status = ref(""),
    confirmDiscard = ref(false);
  let pending = null;
  const models = computed(() =>
    visibleModels(editor.catalogue).filter((m) =>
      kind.value === "object"
        ? m.tileType === "object"
        : m.collection === editor.collection && m.tileType !== "object",
    ),
  );
  const dirty = computed(
    () =>
      base.value &&
      (JSON.stringify(draft.value) !==
        JSON.stringify(modelMetadata(base.value)) ||
        JSON.stringify(behaviour.value) !==
          JSON.stringify(baseBehaviour.value) ||
        blockers.value !== JSON.stringify(base.value.blockers, null, 2)),
  );
  function load(model) {
    base.value = modelMetadata(model);
    draft.value = modelMetadata(model);
    baseBehaviour.value = JSON.parse(
      JSON.stringify(
        model.behaviour || { revision: 1, defaultLights: [], transitions: [] },
      ),
    );
    behaviour.value = JSON.parse(JSON.stringify(baseBehaviour.value));
    blockers.value = JSON.stringify(draft.value.blockers, null, 2);
    error.value = status.value = "";
  }
  function request(action) {
    if (saving.value) return;
    if (dirty.value) {
      pending = action;
      confirmDiscard.value = true;
    } else action();
  }
  function choose(id) {
    const model = editor.catalogue.find((m) => m.id === id);
    if (model && model.id !== base.value?.id) request(() => load(model));
  }
  function changeCollection(value) {
    if (value === editor.collection) return;
    request(() => {
      editor.collection = value;
      if (models.value.length) load(firstModel());
    });
  }
  function changeKind(value) {
    if (value === kind.value) return;
    request(() => {
      kind.value = value;
      if (models.value.length) load(firstModel());
    });
  }
  function discard() {
    confirmDiscard.value = false;
    const action = pending;
    pending = null;
    action?.();
  }
  function reset() {
    if (base.value) load({ ...base.value, behaviour: baseBehaviour.value });
  }
  async function save() {
    if (!draft.value || !dirty.value || saving.value) return;
    error.value = status.value = "";
    try {
      const m = draft.value;
      if (
        ![
          m.width,
          m.height,
          m.mountDepth,
          m.surfaceHeight,
          m.maxHeight,
          ...m.placementOffset,
          ...m.placementPoints.flatMap((p) => [p.x, p.y, p.elevation]),
          ...m.supportSlots.flatMap((s) => [
            s.x,
            s.y,
            s.width,
            s.height,
            s.elevation,
          ]),
        ].every(Number.isFinite)
      )
        throw new Error("Заполните числовые параметры тайла и пазов");
      const contours = JSON.parse(blockers.value);
      if (
        !Array.isArray(contours) ||
        contours.some(
          (p) =>
            !Array.isArray(p) ||
            p.some(
              (v) =>
                !Array.isArray(v) ||
                v.length !== 2 ||
                !v.every(Number.isFinite),
            ),
        )
      )
        throw new Error("Контуры должны содержать полигоны из точек [x, y]");
      saving.value = true;
      const saved = await saveMapModelMetadata(base.value.id, {
        ...modelMetadata(draft.value),
        behaviour: JSON.parse(JSON.stringify(behaviour.value)),
        blockers: contours,
      });
      editor.catalogue = editor.catalogue.map((m) =>
        m.id === saved.id ? saved : m,
      );
      if (editor.selectedModel === base.value.id)
        editor.selectedModel = saved.id;
      load(saved);
      status.value = "Параметры сохранены";
    } catch (cause) {
      error.value = cause.message;
    } finally {
      saving.value = false;
    }
  }
  function reload() {
    request(async () => {
      const old = base.value;
      await editor.retryModels();
      const latest =
        models.value.find(
          (m) =>
            m.sourceCode === old?.sourceCode &&
            m.sourceName === old?.sourceName,
        ) || models.value[0];
      if (latest) load(latest);
    });
  }
  function prepareLeave() {
    if (dirty.value || saving.value) {
      error.value =
        "Сохраните или отмените изменения параметров тайла перед выходом";
      return false;
    }
    return true;
  }
  const firstModel = () =>
    models.value.find((m) => m.tileType === "floor") || models.value[0];
  watch(
    models,
    () => {
      if (!base.value && models.value.length) load(firstModel());
      else if (
        !dirty.value &&
        base.value &&
        !models.value.some((m) => m.id === base.value.id) &&
        models.value.length
      )
        load(firstModel());
    },
    { immediate: true },
  );
  return {
    base,
    draft,
    behaviour,
    kind,
    blockers,
    error,
    saving,
    status,
    dirty,
    confirmDiscard,
    choose,
    changeCollection,
    changeKind,
    discard,
    reset,
    save,
    reload,
    prepareLeave,
  };
}
