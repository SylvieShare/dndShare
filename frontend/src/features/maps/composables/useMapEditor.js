import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { saveMap } from '@/shared/api/mapsApi';
import {
  clone,
  flood,
  inside,
  lineCells,
  newMap,
  paint,
  rectangle,
  resized,
  snap,
  uid,
} from '../lib/mapModel';

export function useMapEditor(source, onSaved) {
  const draft = ref(clone(source || newMap())),
    tool = ref(source?.document.kind && source.document.kind !== 'tiles' ? 'select' : 'brush'),
    terrain = ref('wall-stone'),
    objectKind = ref('barrel'),
    brushSize = ref(1);
  const selectedZone = ref(''),
    selectedObject = ref(''),
    selection = ref(null),
    saving = ref(false),
    error = ref(''),
    conflict = ref(false);
  const history = ref([]),
    future = ref([]),
    saved = ref(source?.id && !source.system ? JSON.stringify(draft.value) : '');
  let timer,
    gesture,
    clipboard,
    stopped = false;
  if (draft.value.system) {
    delete draft.value.id;
    draft.value.system = false;
    draft.value.name += ' · копия';
    draft.value.revision = 0;
  }
  const dirty = computed(() => JSON.stringify(draft.value) !== saved.value);
  function checkpoint() {
    history.value.push(clone(draft.value));
    if (history.value.length > 50) history.value.shift();
    future.value = [];
  }
  function change(fn) {
    checkpoint();
    fn(draft.value);
  }
  function undo() {
    if (!history.value.length) return;
    future.value.push(clone(draft.value));
    draft.value = history.value.pop();
    gesture = null;
    selection.value = null;
  }
  function redo() {
    if (!future.value.length) return;
    history.value.push(clone(draft.value));
    draft.value = future.value.pop();
    selection.value = null;
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
      (draft.value.document.kind !== 'tiles' && !draft.value.document.background.url)
    )
      return;
    saving.value = true;
    error.value = '';
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
      if (dirty.value && !error.value && !stopped) timer = setTimeout(save, 800);
    }
  }
  watch(
    draft,
    () => {
      clearTimeout(timer);
      if (!gesture && !conflict.value) timer = setTimeout(save, 1200);
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
    tool.value = 'zone';
  }
  function draw(point, previous = point) {
    const d = draft.value.document;
    if (d.kind === 'tiles' && (tool.value === 'brush' || tool.value === 'erase'))
      paint(
        d,
        lineCells(previous, point),
        tool.value === 'erase' ? d.base : terrain.value,
        brushSize.value,
      );
    if (tool.value === 'zone-brush') {
      const zone = d.zones.find((z) => z.id === selectedZone.value);
      if (!zone) return;
      const cells = new Set(zone.cells);
      const from = { x: previous.x - d.grid.offsetX, y: previous.y - d.grid.offsetY };
      const to = { x: point.x - d.grid.offsetX, y: point.y - d.grid.offsetY };
      for (const p of lineCells(from, to))
        if (inside(d, p.x, p.y)) cells.add(p.y * Math.ceil(d.width) + p.x);
      zone.cells = [...cells];
    }
  }
  function handle({ phase, point, event }) {
    const d = draft.value.document;
    if (phase === 'hover') return;
    if (phase === 'cancel') {
      if (gesture) {
        draft.value = gesture.before;
        history.value.pop();
      }
      gesture = null;
      selection.value = null;
      return;
    }
    if (phase === 'start') {
      if (!inside(d, point.x, point.y)) return;
      clearTimeout(timer);
      gesture = { start: point, last: point, before: clone(draft.value) };
      checkpoint();
      if (tool.value === 'select') {
        const hit = [...d.objects]
          .reverse()
          .find((o) => Math.hypot(o.x - point.x, o.y - point.y) < o.scale * 0.7);
        selectedObject.value = hit?.id || '';
        gesture.object = hit?.id;
      } else if (tool.value === 'object') {
        const o = {
          id: uid(),
          kind: objectKind.value,
          ...snap(d, point),
          rotation: 0,
          scale: 1,
          open: false,
        };
        d.objects.push(o);
        selectedObject.value = o.id;
      } else if (tool.value === 'fill') flood(d, point, terrain.value);
      else if (tool.value === 'paste' && clipboard) {
        const ox = Math.floor(point.x),
          oy = Math.floor(point.y);
        for (const c of clipboard.cells) paint(d, [{ x: ox + c.x, y: oy + c.y }], c.terrain);
        for (const o of clipboard.objects) {
          const next = { ...o, id: uid(), x: ox + o.x, y: oy + o.y };
          if (inside(d, next.x, next.y)) d.objects.push(next);
        }
      } else draw(point);
    } else if (gesture && phase === 'move') {
      if (gesture.object) {
        const o = d.objects.find((o) => o.id === gesture.object);
        Object.assign(o, snap(d, point));
      } else if (['rect', 'zone', 'select'].includes(tool.value))
        selection.value = rectangle(d, gesture.start, point, d.kind !== 'image');
      else draw(point, gesture.last);
      gesture.last = point;
    } else if (gesture && phase === 'end') {
      const r = rectangle(d, gesture.start, point, d.kind !== 'image');
      if (tool.value === 'rect') {
        const cells = [];
        for (let y = r.y; y < r.y + r.height; y++)
          for (let x = r.x; x < r.x + r.width; x++) cells.push({ x, y });
        paint(d, cells, terrain.value);
      }
      if (tool.value === 'zone') {
        let zone = d.zones.find((z) => z.id === selectedZone.value);
        if (!zone) {
          zone = { id: uid(), name: `Зона ${d.zones.length + 1}`, cells: [], rects: [] };
          d.zones.push(zone);
          selectedZone.value = zone.id;
        }
        zone.rects.push(r);
      }
      if (tool.value !== 'select') selection.value = null;
      gesture = null;
      clearTimeout(timer);
      timer = setTimeout(save, 1200);
    }
  }
  function copy() {
    const r = selection.value,
      d = draft.value.document;
    if (!r) return;
    const cells = [];
    for (let y = r.y; y < r.y + r.height; y++)
      for (let x = r.x; x < r.x + r.width; x++)
        cells.push({ x: x - r.x, y: y - r.y, terrain: d.cells[`${x},${y}`] || d.base });
    clipboard = {
      cells,
      objects: d.objects
        .filter((o) => o.x >= r.x && o.x < r.x + r.width && o.y >= r.y && o.y < r.y + r.height)
        .map((o) => ({ ...o, x: o.x - r.x, y: o.y - r.y })),
    };
    tool.value = 'paste';
  }
  function removeSelected() {
    change((m) => {
      if (selectedObject.value)
        m.document.objects = m.document.objects.filter((o) => o.id !== selectedObject.value);
      else if (selectedZone.value)
        m.document.zones = m.document.zones.filter((z) => z.id !== selectedZone.value);
    });
    selectedObject.value = '';
  }
  function beforeUnload(e) {
    if (dirty.value) {
      e.preventDefault();
      e.returnValue = '';
    }
  }
  window.addEventListener('beforeunload', beforeUnload);
  onBeforeUnmount(() => {
    stopped = true;
    clearTimeout(timer);
    window.removeEventListener('beforeunload', beforeUnload);
  });
  return {
    draft,
    tool,
    terrain,
    objectKind,
    brushSize,
    selectedZone,
    selectedObject,
    selection,
    saving,
    error,
    conflict,
    dirty,
    history,
    future,
    save,
    change,
    undo,
    redo,
    resize,
    addZone,
    handle,
    copy,
    removeSelected,
  };
}
