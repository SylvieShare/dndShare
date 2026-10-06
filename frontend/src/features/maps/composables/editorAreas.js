import { computed } from "vue";
import { uid } from "../lib/mapModel";
import { assignArea, hiddenAreaMembers } from "../lib/mapAreas";
export function editorAreas(e) {
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
        .filter(
          (t) =>
            !hidden.tiles.has(t.id) && e.selectedTiles.value.includes(t.id),
        )
        .map((t) => t.id),
      objects: d.objects
        .filter(
          (o) =>
            !hidden.objects.has(o.id) &&
            (o.id === e.selectedObject.value || inside(o)),
        )
        .map((o) => o.id),
    };
  });
  function addArea() {
    e.change((m) =>
      m.document.areas.push({
        id: uid(),
        name: `Область ${m.document.areas.length + 1}`,
        hidden: false,
        tileIds: [],
        objectIds: [],
      }),
    );
  }
  function renameArea(id, name) {
    name = name.trim();
    const area = e.draft.value.document.areas.find((a) => a.id === id);
    if (!area || !name || name === area.name) return;
    e.change(() => {
      area.name = name;
    });
  }
  function setAreaHidden(id, hidden) {
    const area = e.draft.value.document.areas.find((a) => a.id === id);
    if (!area || area.hidden === hidden) return;
    e.change(() => {
      area.hidden = hidden;
    });
    if (hidden) {
      e.setTileSelection(
        e.selectedTiles.value.filter((id) => !area.tileIds.includes(id)),
      );
      if (area.objectIds.includes(e.selectedObject.value))
        e.selectedObject.value = "";
      e.selection.value = null;
    }
  }
  function addSelectionToArea(id) {
    e.change((m) => assignArea(m.document, id, members.value));
  }
  function removeSelectionFromArea(id) {
    const selected = members.value;
    e.change((m) => {
      const a = m.document.areas.find((a) => a.id === id);
      if (!a) return;
      a.tileIds = a.tileIds.filter((id) => !selected.tiles.includes(id));
      a.objectIds = a.objectIds.filter((id) => !selected.objects.includes(id));
    });
  }
  function removeArea(id) {
    e.change((m) => {
      m.document.areas = m.document.areas.filter((a) => a.id !== id);
    });
  }
  function removeAreaMember(id, kind, member) {
    e.change((m) => {
      const a = m.document.areas.find((a) => a.id === id);
      if (a) a[kind] = a[kind].filter((value) => value !== member);
    });
  }
  return {
    addArea,
    renameArea,
    setAreaHidden,
    addSelectionToArea,
    removeSelectionFromArea,
    removeArea,
    removeAreaMember,
    areaSelectionCount: computed(
      () => members.value.tiles.length + members.value.objects.length,
    ),
  };
}
