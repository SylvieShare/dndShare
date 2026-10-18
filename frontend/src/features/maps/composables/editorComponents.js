import { ref } from "vue";
import { clone, inside, uid } from "../lib/mapModel";
import { effectPose } from "../lib/mapComponents";

export function editorComponents(e, lighting) {
  const selectedEffect = ref(""),
    selectedFlag = ref(""),
    previewEffect = ref(null),
    bindingEffect = ref(""),
    copiedEffect = ref(null);
  let gesture,
    placing = false,
    editKey = "",
    editTimer,
    preset;
  const document = () => e.draft.value.document;
  const effect = (id) => document().effects.find((x) => x.id === id);
  function finishComponentEdit() {
    editKey = "";
    clearTimeout(editTimer);
  }
  function selectComponent(kind, id) {
    e.setTileSelection([]);
    e.setObjectSelection([]);
    e.selection.value = null;
    lighting.selectedLight.value = "";
    selectedEffect.value = kind === "effect" ? id : "";
    selectedFlag.value = kind === "flag" ? id : "";
    e.tool.value = "select";
  }
  function clearComponentFocus() {
    selectedEffect.value = selectedFlag.value = "";
  }
  function copyEffect() {
    const item = effect(selectedEffect.value);
    if (!item) return false;
    const { anchor, areaId, builtinKey, overrides, ...snapshot } = clone(item);
    copiedEffect.value = { ...snapshot, offset: [0, 0] };
    return true;
  }
  function updateEffect(id, field, value) {
    const item = effect(id);
    if (
      !item ||
      (item.builtinKey &&
        !["enabled", "color", "size", "strength", "height", "flagId"].includes(
          field,
        ))
    )
      return;
    const key = `${id}:${field}`;
    if (editKey !== key) e.checkpoint();
    editKey = key;
    item[field] = value;
    if (item.builtinKey && field !== "enabled")
      item.overrides = { ...item.overrides, [field]: clone(value) };
    clearTimeout(editTimer);
    editTimer = setTimeout(finishComponentEdit, 350);
  }
  function updateFlag(id, field, value) {
    if (!["name", "enabled"].includes(field)) return;
    const item = document().flags.find((f) => f.id === id);
    if (item)
      e.change(() => {
        item[field] = value;
      });
  }
  function addFlag() {
    const item = { id: uid(), name: "Новый флаг", enabled: true };
    e.change((m) => m.document.flags.push(item));
    selectComponent("flag", item.id);
  }
  function removeComponent(kind, id) {
    finishComponentEdit();
    const item = (kind === "flag" ? document().flags : document().effects).find(
      (x) => x.id === id,
    );
    if (!item || item.builtinKey) return;
    e.change((m) => {
      m.document[kind === "flag" ? "flags" : "effects"] = m.document[
        kind === "flag" ? "flags" : "effects"
      ].filter((x) => x.id !== id);
      if (kind === "flag")
        for (const dep of [...m.document.lights, ...m.document.effects]) {
          if (dep.flagId !== id) continue;
          dep.flagId = "";
          if (dep.overrides) dep.overrides.flagId = "";
        }
    });
    clearComponentFocus();
  }
  function bindEffect(id, anchor) {
    const item = effect(id);
    if (!item || item.builtinKey) return;
    const current = effectPose(item, document(), e.catalogue.value);
    e.change(() => {
      item.anchor = anchor;
      item.areaId = "";
      item.offset = [0, 0];
      if (anchor) {
        const base = effectPose(item, document(), e.catalogue.value),
          owner = (
            anchor.kind === "tile" ? document().tiles : document().objects
          ).find((x) => x.id === anchor.id),
          a = ((owner?.rotation || 0) * Math.PI) / 180,
          x = current.x - base.x,
          y = current.y - base.y;
        item.offset = [
          x * Math.cos(a) + y * Math.sin(a),
          -x * Math.sin(a) + y * Math.cos(a),
        ].map((v) => Math.max(-8, Math.min(8, v)));
        item.height = Math.max(
          0,
          Math.min(16, current.worldHeight - base.elevation),
        );
        const posed = effectPose(item, document(), e.catalogue.value);
        Object.assign(item, {
          x: posed.x,
          y: posed.y,
          elevation: posed.elevation,
        });
      } else
        Object.assign(item, {
          x: current.x,
          y: current.y,
          elevation: current.elevation,
        });
    });
  }
  function beginEffectBinding(id) {
    if (effect(id)?.builtinKey) return;
    selectComponent("effect", id);
    bindingEffect.value = id;
    e.tool.value = "bind-effect";
  }
  function resetComponentGesture() {
    gesture = null;
    placing = false;
    bindingEffect.value = "";
    previewEffect.value = null;
    if (["effect", "bind-effect"].includes(e.tool.value))
      e.tool.value = "select";
    e.pauseSave(false);
  }
  const effectDrag = {
    kind: "effect",
    begin(kind) {
      preset =
        typeof kind === "object"
          ? clone(kind)
          : {
              name: "Огонь",
              kind: "fire",
              color: "#ffb04a",
              size: [0.4, 0.7],
              strength: 0.7,
              enabled: true,
              height: 0,
            };
      selectComponent("effect", "");
      placing = true;
      e.tool.value = "effect";
      e.pauseSave(true);
    },
    move(point) {
      previewEffect.value =
        placing && point && inside(document(), point.x, point.y)
          ? {
              ...preset,
              id: "preview-effect",
              x: point.x,
              y: point.y,
              elevation: point.elevation || 0,
              offset: [0, 0],
              placing: true,
            }
          : null;
    },
    drop(point) {
      effectDrag.move(point);
      if (
        previewEffect.value &&
        document().effects.filter((x) => !x.builtinKey).length < 128
      ) {
        const { placing: _, ...item } = previewEffect.value;
        item.id = uid();
        e.change((m) => m.document.effects.push(item));
        selectComponent("effect", item.id);
      }
      resetComponentGesture();
    },
    cancel: resetComponentGesture,
  };
  function handleComponent(event) {
    const { phase, hit, point } = event;
    if (bindingEffect.value) {
      if (phase === "cancel") resetComponentGesture();
      if (phase === "start") {
        const anchor = hit?.tileId
          ? { kind: "tile", id: hit.tileId }
          : hit?.objectId
            ? { kind: "object", id: hit.objectId }
            : null;
        if (anchor) {
          bindEffect(bindingEffect.value, anchor);
          resetComponentGesture();
        }
      }
      return true;
    }
    if (phase === "start" && hit?.effectId && e.tool.value === "select") {
      const item = effect(hit.effectId);
      if (!item) return false;
      selectComponent("effect", item.id);
      if (!item.builtinKey) {
        gesture = {
          before: clone(e.draft.value),
          item: clone(item),
          moved: false,
        };
        e.pauseSave(true);
      }
      return true;
    }
    if (!gesture) return false;
    if (phase === "move" && point && inside(document(), point.x, point.y)) {
      if (
        !gesture.moved &&
        Math.hypot(point.x - gesture.item.x, point.y - gesture.item.y) < 0.05
      )
        return true;
      if (!gesture.moved) {
        e.checkpoint();
        gesture.moved = true;
      }
      const item = effect(gesture.item.id);
      Object.assign(item, {
        x: point.x,
        y: point.y,
        elevation: point.elevation || 0,
        anchor: null,
        offset: [0, 0],
        areaId: "",
      });
      previewEffect.value = { ...item, moving: true };
    }
    if (phase === "cancel") {
      if (gesture.moved) {
        e.draft.value = gesture.before;
        e.history.value.pop();
      }
      resetComponentGesture();
    } else if (phase === "end") resetComponentGesture();
    return true;
  }
  return {
    selectedEffect,
    selectedFlag,
    previewEffect,
    bindingEffect,
    addFlag,
    updateFlag,
    updateEffect,
    removeComponent,
    selectComponent,
    clearComponentFocus,
    effectDrag,
    finishComponentEdit,
    beginEffectBinding,
    bindEffect,
    resetComponentGesture,
    handleComponent,
    copiedEffect,
    copyEffect,
  };
}
