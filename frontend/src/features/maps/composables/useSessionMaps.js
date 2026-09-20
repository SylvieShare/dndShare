import { computed, onBeforeUnmount, ref } from 'vue';
import {
  addSessionMap,
  deleteSessionMap,
  getSessionMaps,
  saveMapDisplay,
  saveSessionMap,
} from '@/shared/api/mapsApi';
import { clone } from '../lib/mapModel';
import { useMapSync } from './useMapSync';

export function useSessionMaps(uuid) {
  const maps = ref([]),
    display = ref(null),
    selectedID = ref(''),
    loading = ref(true),
    saving = ref(false),
    displaySaving = ref(false),
    error = ref(''),
    conflict = ref(false),
    editing = ref(false);
  const pending = new Set(),
    selected = computed(() => maps.value.find((m) => m.id === selectedID.value));
  let stopped = false,
    refreshAfterSave = false,
    activeSave = null;
  async function load(force = false) {
    if (!force && (saving.value || pending.size || editing.value || displaySaving.value)) {
      refreshAfterSave = true;
      return;
    }
    try {
      const result = await getSessionMaps(uuid);
      if (stopped) return;
      // An edit may have started while the read was in flight.
      if (!force && (saving.value || pending.size || editing.value || displaySaving.value)) {
        refreshAfterSave = true;
        return;
      }
      maps.value = result.maps;
      display.value = result.display;
      error.value = '';
      if (!maps.value.some((m) => m.id === selectedID.value))
        selectedID.value = result.display.mapId || maps.value[0]?.id || '';
      if (force) {
        pending.clear();
        conflict.value = false;
        error.value = '';
      }
    } catch (cause) {
      error.value = cause.message;
      throw cause;
    } finally {
      loading.value = false;
    }
  }
  const { connected } = useMapSync(`/api/sessions/${uuid}/map-events`, load);
  function flush() {
    if (!activeSave)
      activeSave = savePending().finally(() => {
        activeSave = null;
      });
    return activeSave;
  }
  async function savePending() {
    if (conflict.value) return;
    saving.value = true;
    error.value = '';
    try {
      while (pending.size) {
        const id = pending.values().next().value,
          m = maps.value.find((m) => m.id === id);
        pending.delete(id);
        if (!m) continue;
        try {
          const result = await saveSessionMap(uuid, clone(m));
          m.revision = result.revision;
        } catch (cause) {
          pending.add(id);
          throw cause;
        }
      }
    } catch (cause) {
      error.value = cause.message;
      conflict.value = cause.status === 409;
    } finally {
      saving.value = false;
      if (refreshAfterSave && !pending.size && !stopped) {
        refreshAfterSave = false;
        load().catch(() => {});
      }
    }
  }
  function persist() {
    if (!selected.value) return;
    pending.add(selected.value.id);
    flush();
  }
  function change(fn) {
    if (!selected.value || conflict.value) return;
    fn(selected.value.state);
    persist();
  }
  async function add(map) {
    error.value = '';
    try {
      const result = await addSessionMap(uuid, map.id);
      maps.value.push(result);
      selectedID.value = result.id;
      return true;
    } catch (cause) {
      error.value = cause.message;
      return false;
    }
  }
  async function remove(id) {
    if (saving.value || pending.size) return false;
    try {
      await deleteSessionMap(uuid, id);
      await load(true);
      return true;
    } catch (cause) {
      error.value = cause.message;
      return false;
    }
  }
  async function updateDisplay(patch) {
    if (displaySaving.value || !display.value) return;
    displaySaving.value = true;
    error.value = '';
    try {
      display.value = await saveMapDisplay(uuid, { ...clone(display.value), ...patch });
    } catch (cause) {
      error.value = cause.message;
      if (cause.status === 409) conflict.value = true;
    } finally {
      displaySaving.value = false;
    }
  }
  function unload(event) {
    if (pending.size || saving.value) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
  window.addEventListener('beforeunload', unload);
  onBeforeUnmount(() => {
    stopped = true;
    window.removeEventListener('beforeunload', unload);
  });
  return {
    maps,
    display,
    selectedID,
    selected,
    loading,
    saving,
    displaySaving,
    error,
    conflict,
    editing,
    connected,
    load,
    flush,
    retry: () => (pending.size ? flush() : load().catch(() => {})),
    persist,
    change,
    add,
    remove,
    updateDisplay,
    hasPending: () => pending.size > 0 || saving.value,
  };
}
