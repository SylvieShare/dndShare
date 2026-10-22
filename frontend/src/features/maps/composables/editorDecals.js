import { onBeforeUnmount, ref } from "vue";
import { clone, uid } from "../lib/mapModel";
import { createDecal } from "../lib/mapDecals";

export function editorDecals(e) {
  const selectedDecal = ref(""),
    previewDecal = ref(null),
    copiedDecal = ref(null);
  let template,
    editing = "",
    timer,
    selecting = false;
  const items = () => e.draft.value.document.decals || [];
  function finishDecalEdit() {
    clearTimeout(timer);
    editing = "";
    e.commitEdit();
  }
  function clearSelection() {
    e.finishOtherEdit?.();
    e.clearAreaFocus?.();
    e.setTileSelection([]);
    e.setObjectSelection([]);
    e.selectedLight.value = "";
    e.selection.value = null;
  }
  function selectDecal(id) {
    finishDecalEdit();
    clearSelection();
    selectedDecal.value = id;
    e.tool.value = "select";
  }
  function beginDecal(image, moving = false) {
    finishDecalEdit();
    clearSelection();
    selectedDecal.value = "";
    template = moving
      ? clone(image)
      : image.position
        ? { ...clone(image), id: uid() }
        : createDecal(image, {});
    template.moving = moving;
    e.tool.value = "decal";
    previewDecal.value = null;
  }
  function reset() {
    finishDecalEdit();
    template = null;
    previewDecal.value = null;
    selecting = false;
    if (e.tool.value === "decal") e.tool.value = "select";
  }
  function preview(point) {
    previewDecal.value =
      point?.decalSurface && template
        ? { ...template, ...point.decalSurface, preview: true }
        : null;
  }
  function handle({ phase, point, hit, event }) {
    if (phase === "cancel") {
      reset();
      return false;
    }
    if (e.tool.value === "decal") {
      preview(point);
      if (phase === "start" && previewDecal.value) {
        const {
          preview: ignored,
          moving,
          ...decal
        } = clone(previewDecal.value);
        try {
          e.change((m) => {
            m.document.decals ||= [];
            if (moving)
              Object.assign(
                m.document.decals.find((d) => d.id === decal.id),
                decal,
              );
            else if (m.document.decals.length < 512)
              m.document.decals.push(decal);
            else throw new Error("Не больше 512 декалей на карте");
          });
        } catch (cause) {
          e.error.value = cause.message;
          return true;
        }
        if ((event?.ctrlKey || event?.metaKey) && !moving) {
          template.id = uid();
          preview(point);
        } else {
          reset();
          selectDecal(decal.id);
          selecting = true;
        }
      }
      return true;
    }
    if (selecting) {
      if (phase === "end") selecting = false;
      return phase !== "hover";
    }
    if (phase === "start") {
      finishDecalEdit();
      if (hit?.decalId) {
        selectDecal(hit.decalId);
        selecting = true;
        return true;
      }
      selectedDecal.value = "";
    }
    return false;
  }
  function updateDecal(field, value) {
    const decal = items().find((d) => d.id === selectedDecal.value);
    if (!decal) return;
    const key = `${decal.id}:${field}`;
    if (editing !== key) {
      finishDecalEdit();
      e.checkpoint();
      editing = key;
    }
    decal[field] = value;
    clearTimeout(timer);
    timer = setTimeout(finishDecalEdit, 350);
  }
  onBeforeUnmount(finishDecalEdit);
  return {
    selectedDecal,
    previewDecal,
    copiedDecal,
    beginDecal,
    selectDecal,
    moveDecal: (decal) => beginDecal(decal, true),
    updateDecal,
    finishDecalEdit,
    reset,
    handle,
    copy() {
      const decal = items().find((d) => d.id === selectedDecal.value);
      if (!decal) return false;
      copiedDecal.value = clone(decal);
      return true;
    },
    remove() {
      if (!selectedDecal.value) return false;
      if (!items().some((d) => d.id === selectedDecal.value)) {
        selectedDecal.value = "";
        return true;
      }
      e.change((m) => {
        m.document.decals = m.document.decals.filter(
          (d) => d.id !== selectedDecal.value,
        );
      });
      selectedDecal.value = "";
      return true;
    },
    rotate() {
      if (e.tool.value === "decal" && template) {
        template.rotation = (template.rotation + 15) % 360;
        if (previewDecal.value)
          previewDecal.value = {
            ...previewDecal.value,
            rotation: template.rotation,
          };
        return true;
      }
      const item = items().find((d) => d.id === selectedDecal.value);
      if (!item) return false;
      updateDecal("rotation", (item.rotation + 15) % 360);
      finishDecalEdit();
      return true;
    },
  };
}
