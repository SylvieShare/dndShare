import { sessionMapRemoval } from "./sessionMapRemoval";
import { useNotificationsStore } from "@/stores/notifications";
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
  const removal = sessionMapRemoval({
    maps,
    selectedID,
    display,
    request: (id) => deleteSessionMap(uuid, id),
    notify: (map, cause) =>
      useNotificationsStore().notify({
        type: "error",
        title: `Не удалось удалить карту «${map.name}»`,
        data: { message: cause.message },
        duration: 12000,
      }),
    settled: (success) => {
      if (success && !stopped) load().catch(() => {});
    },
  });
  async function load(force = false) {
    if (!force && busy()) {
      refreshPending = true;
      return;
    }
    try {
      const before = removal.epoch;
      const result = await getSessionMaps(uuid, force);
      if (before !== removal.epoch) {
        refreshPending = true;
        return;
      }
      if (stopped) return;
      if (!force && busy()) {
        refreshPending = true;
        return;
      }
      maps.value = result.maps.filter((map) => !removal.pending.has(map.id));
      display.value = removal.pending.has(result.display.mapId)
        ? display.value
        : result.display;
      if (!maps.value.some((m) => m.id === selectedID.value))
        selectedID.value = maps.value.some((m) => m.id === result.display.mapId)
          ? result.display.mapId
          : maps.value[0]?.id || "";
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
      accept(result);
      return result;
    } catch (cause) {
      error.value = cause.message;
      conflict.value = cause.status === 409;
      throw cause;
    } finally {
      saving.value = false;
    }
  }
  function accept(map) {
    maps.value = maps.value.map(record => record.id === map.id ? map : record);
    error.value = '';
    conflict.value = false;
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
  function remove(id) {
    return !busy() && removal.remove(id);
  }
  async function updateDisplay(patch) {
    if (displaySaving.value || !display.value) return;
    displaySaving.value = true;
    error.value = "";
    try {
      if (removal.pending.size) {
        await removal.wait();
        if (stopped) return;
        display.value = (await getSessionMaps(uuid)).display;
      }
      if (patch.mapId && !maps.value.some((map) => map.id === patch.mapId))
        return;
      display.value = await saveMapDisplay(uuid, {
        ...clone(display.value),
        ...patch,
      });
    } catch (cause) {
      error.value = cause.message;
      conflict.value = cause.status === 409;
    } finally {
      displaySaving.value = false;
      if (refreshPending && !busy() && !stopped) load().catch(() => {});
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
    accept,
    working,
    add,
    addImage(map) {
      maps.value.push(map);
      selectedID.value = map.id;
    },
    remove,
    updateDisplay,
  };
}
