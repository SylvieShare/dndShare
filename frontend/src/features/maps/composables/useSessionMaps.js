import { computed, onBeforeUnmount, ref } from "vue";
import {
  addSessionMap,
  deleteSessionMap,
  getSessionMaps,
  saveMapDisplay,
  saveSessionMap,
} from "@/shared/api/mapsApi";
import { clone } from "../lib/mapModel";
import { useMapSync } from "./useMapSync";
export function useSessionMaps(uuid) {
  const maps = ref([]),
    display = ref(null),
    selectedID = ref(""),
    loading = ref(true),
    saving = ref(false),
    displaySaving = ref(false),
    error = ref(""),
    conflict = ref(false),
    editing = ref(false);
  const selected = computed(() =>
    maps.value.find((m) => m.id === selectedID.value),
  );
  let stopped = false,
    refreshPending = false;
  const busy = () => saving.value || editing.value || displaySaving.value;
  async function load(force = false) {
    if (!force && busy()) {
      refreshPending = true;
      return;
    }
    try {
      const result = await getSessionMaps(uuid);
      if (stopped) return;
      if (!force && busy()) {
        refreshPending = true;
        return;
      }
      maps.value = result.maps;
      display.value = result.display;
      if (!maps.value.some((m) => m.id === selectedID.value))
        selectedID.value = result.display.mapId || maps.value[0]?.id || "";
      error.value = "";
      if (force) conflict.value = false;
      refreshPending = false;
    } catch (cause) {
      error.value = cause.message;
      throw cause;
    } finally {
      loading.value = false;
    }
  }
  const { connected } = useMapSync(`/api/sessions/${uuid}/map-events`, load);
  function working(value) {
    editing.value = value;
    if (!value && refreshPending && !busy()) load().catch(() => {});
  }
  async function write(map) {
    saving.value = true;
    error.value = "";
    try {
      const result = await saveSessionMap(uuid, clone(map));
      maps.value = maps.value.map((m) => (m.id === result.id ? result : m));
      return result;
    } catch (cause) {
      error.value = cause.message;
      conflict.value = cause.status === 409;
      throw cause;
    } finally {
      saving.value = false;
    }
  }
  async function add(map) {
    try {
      const result = await addSessionMap(uuid, map.id);
      maps.value.push(result);
      selectedID.value = result.id;
      error.value = "";
      return true;
    } catch (cause) {
      error.value = cause.message;
      return false;
    }
  }
  async function remove(id) {
    if (busy()) return false;
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
    error.value = "";
    try {
      display.value = await saveMapDisplay(uuid, {
        ...clone(display.value),
        ...patch,
      });
    } catch (cause) {
      error.value = cause.message;
      conflict.value = cause.status === 409;
    } finally {
      displaySaving.value = false;
    }
  }
  onBeforeUnmount(() => {
    stopped = true;
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
    write,
    working,
    add,
    remove,
    updateDisplay,
  };
}
