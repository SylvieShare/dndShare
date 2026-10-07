import { computed, ref, watch } from "vue";
import { uid } from "../lib/mapModel";
import {
  assignArea,
  hiddenAreaMembers,
  DEFAULT_AREA_COLOR,
} from "../lib/mapAreas";
export function editorAreas(e) {
  const focusedArea = ref("");
  const focused = computed(() =>
    e.draft.value.document.areas.find((a) => a.id === focusedArea.value),
  );
  function clearAreaFocus(clearSelection = false) {
    const hadFocus = !!focusedArea.value;
    focusedArea.value = "";
    if (clearSelection && hadFocus) {
      e.setTileSelection([]);
      e.setObjectSelection([]);
    }
  }
  function syncFocus() {
    if (!focusedArea.value) return;
    if (!focused.value) {
      clearAreaFocus(true);
      return;
    }
    e.setTileSelection(focused.value.tileIds);
    e.setObjectSelection(focused.value.objectIds);
    if (e.selectedLight) e.selectedLight.value = "";
  }
  watch(
    () => [
      focusedArea.value,
      focused.value?.tileIds.slice(),
      focused.value?.objectIds.slice(),
    ],
    syncFocus,
    { deep: true, flush: "sync" },
  );
  watch(
    [
      e.selectedTiles,
      e.selectedObjects,
      e.tool,
      ...(e.selectedLight ? [e.selectedLight] : []),
    ],
    () => {
      const area = focused.value;
      if (!area) return;
      const same = (a, b) =>
        a.length === b.length && a.every((id) => b.includes(id));
      if (
        e.tool.value !== "select" ||
        e.selectedLight?.value ||
        !same(e.selectedTiles.value, area.tileIds) ||
        !same(e.selectedObjects.value, area.objectIds)
      )
        clearAreaFocus();
    },
  );
  const members = computed(() => {
    const d = e.draft.value.document,
      r = e.selection.value;
    const hidden = hiddenAreaMembers(d);
    const inside = (o) =>
      r &&
      o.x >= r.x &&
      o.y >= r.y &&
      o.x < r.x + r.width &&
      o.y < r.y + r.height;
    return {
      tiles: d.tiles
        .filter((t) => e.selectedTiles.value.includes(t.id))
        .map((t) => t.id),
      objects: d.objects
        .filter(
          (o) =>
            e.selectedObjects.value.includes(o.id) ||
            (!hidden.objects.has(o.id) && inside(o)),
        )
        .map((o) => o.id),
    };
  });
  function addArea(includeSelection = false, lightId = null) {
    const id = uid();
    const selected =
      includeSelection === true ? members.value : { tiles: [], objects: [] };
    e.change((m) => {
      m.document.areas.push({
        id,
        name: `Область ${m.document.areas.length + 1}`,
        hidden: false,
        color: DEFAULT_AREA_COLOR,
        tileIds: [],
        objectIds: [],
      });
      if (selected.tiles.length || selected.objects.length)
        assignArea(m.document, id, selected);
      if (lightId) {
        const light = m.document.lights.find((l) => l.id === lightId);
        if (light) light.areaId = id;
      }
    });
    return id;
  }
  function renameArea(id, name) {
    name = name.trim();
    const area = e.draft.value.document.areas.find((a) => a.id === id);
    if (!area || !name || name === area.name) return;
    e.change(() => {
      area.name = name;
    });
  }
  function setAreaColor(id, value) {
    value = String(value).trim();
    if (/^#[0-9a-f]{3}$/i.test(value))
      value = "#" + [...value.slice(1)].map((c) => c + c).join("");
    if (/^#[0-9a-f]{8}$/i.test(value)) value = value.slice(0, 7);
    const area = e.draft.value.document.areas.find((a) => a.id === id);
    if (!area || !/^#[0-9a-f]{6}$/i.test(value) || value === area.color) return;
    e.change(() => {
      area.color = value;
    });
  }
  function removeAreaMember(id, kind, memberId) {
    const area = e.draft.value.document.areas.find((a) => a.id === id);
    const key = kind === "tile" ? "tileIds" : "objectIds";
    if (!area || !area[key].includes(memberId)) return;
    e.change(() => {
      area[key] = area[key].filter((item) => item !== memberId);
    });
  }
  function setAreaHidden(id, hidden) {
    const area = e.draft.value.document.areas.find((a) => a.id === id);
    if (!area || area.hidden === hidden) return;
    e.change(() => {
      area.hidden = hidden;
    });
    if (hidden && focusedArea.value !== id) {
      e.setTileSelection(
        e.selectedTiles.value.filter((id) => !area.tileIds.includes(id)),
      );
      e.setObjectSelection(
        e.selectedObjects.value.filter((id) => !area.objectIds.includes(id)),
      );
      e.selection.value = null;
    }
  }
  function actionMembers(id, removing) {
    const area = e.draft.value.document.areas.find((a) => a.id === id);
    if (!area) return { tiles: [], objects: [] };
    return {
      tiles: members.value.tiles.filter(
        (id) => area.tileIds.includes(id) === removing,
      ),
      objects: members.value.objects.filter(
        (id) => area.objectIds.includes(id) === removing,
      ),
    };
  }
  function areaSelectionCounts(id) {
    const add = actionMembers(id, false),
      remove = actionMembers(id, true);
    return {
      add: add.tiles.length + add.objects.length,
      remove: remove.tiles.length + remove.objects.length,
    };
  }
  function addSelectionToArea(id) {
    const selected = actionMembers(id, false);
    if (!selected.tiles.length && !selected.objects.length) return;
    e.change((m) => assignArea(m.document, id, selected));
  }
  function removeSelectionFromArea(id) {
    const selected = actionMembers(id, true);
    if (!selected.tiles.length && !selected.objects.length) return;
    e.change((m) => {
      const area = m.document.areas.find((a) => a.id === id);
      area.tileIds = area.tileIds.filter((id) => !selected.tiles.includes(id));
      area.objectIds = area.objectIds.filter(
        (id) => !selected.objects.includes(id),
      );
    });
  }
  function selectArea(id) {
    const area = e.draft.value.document.areas.find((a) => a.id === id);
    if (!area) return;
    e.tool.value = "select";
    e.selection.value = null;
    e.screenSelection.value = null;
    e.setTileSelection(area.tileIds);
    e.setObjectSelection(area.objectIds);
    if (e.selectedLight) e.selectedLight.value = "";
    focusedArea.value = id;
  }
  function removeArea(id) {
    e.change((m) => {
      m.document.areas = m.document.areas.filter((a) => a.id !== id);
    });
  }
  return {
    focusedArea,
    clearAreaFocus,
    setAreaColor,
    removeAreaMember,
    addArea,
    renameArea,
    setAreaHidden,
    addSelectionToArea,
    removeSelectionFromArea,
    removeArea,
    selectArea,
    areaSelectionCounts,
  };
}
