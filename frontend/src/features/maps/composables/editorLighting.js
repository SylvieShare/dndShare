import { ref } from "vue";
import { editorLightBinding } from "./editorLightBinding";
import { clone, inside, uid } from "../lib/mapModel";
import { DEFAULT_SUN, LIGHT_PRESETS, lightPose } from "../lib/mapLighting";
import { manualLightCount } from "../lib/builtinLights";
export function editorLighting(e) {
  const selectedLight = ref(""),
    hoveredLight = ref(""),
    previewLight = ref(null),
    copiedLight = ref(null);
  let gesture = null,
    editKey = "",
    editTimer;
  function finishLightEdit() {
    editKey = "";
    clearTimeout(editTimer);
  }
  function patch(key, fn) {
    if (editKey !== key) e.checkpoint();
    editKey = key;
    fn();
    clearTimeout(editTimer);
    editTimer = setTimeout(finishLightEdit, 350);
  }
  function updateLightingMode(value) {
    patch("lightingEnabled", () => {
      e.draft.value.document.lightingEnabled = value;
    });
  }
  function copyLight() {
    const light = e.draft.value.document.lights.find(
      (l) => l.id === selectedLight.value,
    );
    if (!light) return false;
    const { anchor, areaId, builtinKey, ...snapshot } = clone(light);
    copiedLight.value = { ...snapshot, offset: [0, 0] };
    return true;
  }
  function updateSun(field, value) {
    patch(`sun:${field}`, () => {
      e.draft.value.document.sun ||= { ...DEFAULT_SUN };
      e.draft.value.document.sun[field] = value;
    });
  }
  function updateLight(id, field, value) {
    const light = e.draft.value.document.lights.find((l) => l.id === id);
    if (light && (!light.builtinKey || field === "enabled"))
      patch(`${id}:${field}`, () => {
        light[field] = value;
      });
  }
  function selectLight(id) {
    binding.cancelLightBinding();
    selectedLight.value = id;
    e.setTileSelection([]);
    e.setObjectSelection([]);
    e.selection.value = null;
    e.tool.value = "select";
  }
  function removeLight(id = selectedLight.value) {
    if (!id) return;
    finishLightEdit();
    e.change((m) => {
      const light = m.document.lights.find((l) => l.id === id);
      if (light?.builtinKey) light.enabled = false;
      else m.document.lights = m.document.lights.filter((l) => l.id !== id);
    });
    selectedLight.value = "";
    binding.cancelLightBinding();
  }
  function bindLight(id, anchor) {
    const light = e.draft.value.document.lights.find((l) => l.id === id);
    if (!light || light.builtinKey) return;
    e.change(() => {
      light.anchor = anchor;
      light.offset = [0, 0];
      if (anchor) {
        const pose = lightPose(
          light,
          e.draft.value.document,
          e.catalogue.value,
        );
        Object.assign(light, {
          x: pose.x,
          y: pose.y,
          elevation: pose.elevation,
        });
      }
    });
  }
  const binding = editorLightBinding(e, selectedLight, bindLight);
  function toggleLight(id) {
    const light = e.draft.value.document.lights.find((l) => l.id === id);
    if (!light) return;
    e.change(() => {
      if (
        !light.enabled &&
        light.shadows &&
        e.draft.value.document.lights.filter((l) => l.enabled && l.shadows)
          .length >= 2
      )
        light.shadows = false;
      light.enabled = !light.enabled;
    });
  }
  function handle({ phase, point, hit, event }) {
    if (binding.handleBinding({ phase, point, hit, event })) return true;
    if (phase === "hover") {
      hoveredLight.value = hit?.lightId || "";
      return false;
    }
    if (phase === "start" && hit?.lightId && e.tool.value === "select") {
      const light = e.draft.value.document.lights.find(
        (l) => l.id === hit.lightId,
      );
      if (!light) return false;
      if (light.builtinKey) {
        selectLight(light.id);
        return true;
      }
      selectLight(light.id);
      gesture = {
        before: clone(e.draft.value),
        light: clone(light),
        screen: { x: event.clientX, y: event.clientY },
        changed: false,
      };
      e.pauseSave(true);
      return true;
    }
    if (!gesture) return false;
    if (
      phase === "move" &&
      point &&
      inside(e.draft.value.document, point.x, point.y)
    ) {
      if (
        !gesture.changed &&
        Math.hypot(
          event.clientX - gesture.screen.x,
          event.clientY - gesture.screen.y,
        ) < 5
      )
        return true;
      if (!gesture.changed) {
        e.checkpoint();
        gesture.changed = true;
      }
      const light = e.draft.value.document.lights.find(
        (l) => l.id === gesture.light.id,
      );
      Object.assign(light, {
        x: point.x,
        y: point.y,
        elevation: point.elevation || 0,
        anchor: null,
        offset: [0, 0],
      });
      previewLight.value = { ...light, moving: true };
    }
    if (phase === "cancel") {
      if (gesture.changed) {
        e.draft.value = gesture.before;
        e.history.value.pop();
      }
      reset();
    }
    if (phase === "end") reset();
    return true;
  }
  function reset() {
    binding.cancelLightBinding();
    gesture = null;
    previewLight.value = null;
    hoveredLight.value = "";
    e.pauseSave(false);
    if (
      !e.draft.value.document.lights.some((l) => l.id === selectedLight.value)
    )
      selectedLight.value = "";
  }
  let placing = false,
    preset;
  const driver = {
    kind: "light",
    begin(kind) {
      preset =
        typeof kind === "object"
          ? clone(kind)
          : {
              ...(LIGHT_PRESETS.find((p) => p.kind === kind) ||
                LIGHT_PRESETS[0]),
              enabled: true,
              shadows: true,
              showMarker: true,
            };
      placing = true;
      e.tool.value = "light";
      selectedLight.value = "";
      e.setTileSelection([]);
      e.setObjectSelection([]);
      e.selection.value = null;
      e.pauseSave(true);
    },
    move(point) {
      if (!placing) return;
      previewLight.value =
        point && inside(e.draft.value.document, point.x, point.y)
          ? {
              ...preset,
              id: "preview-light",
              x: point.x,
              y: point.y,
              elevation: point.elevation || 0,
              offset: [0, 0],
              placing: true,
            }
          : null;
    },
    drop(point) {
      driver.move(point);
      if (previewLight.value && manualLightCount(e.draft.value.document) < 32) {
        const { placing, ...light } = previewLight.value;
        light.id = uid();
        light.shadows =
          !!light.shadows &&
          e.draft.value.document.lights.filter((l) => l.enabled && l.shadows)
            .length < 2;
        e.change((m) => m.document.lights.push(light));
        selectedLight.value = light.id;
      }
      driver.cancel();
    },
    cancel() {
      if (!placing) return;
      placing = false;
      previewLight.value = null;
      e.tool.value = "select";
      e.pauseSave(false);
    },
  };
  return {
    copiedLight,
    copyLight,
    updateLightingMode,
    ...binding,
    toggleLight,
    selectedLight,
    hoveredLight,
    previewLight,
    updateSun,
    updateLight,
    finishLightEdit,
    selectLight,
    removeLight,
    bindLight,
    handle,
    reset,
    driver,
  };
}
