import { computed, ref } from "vue";

const key = "dndshare.maps.force-lod";
function restore() {
  try {
    return localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}
const value = ref(restore());
const forceLod = computed({
  get: () => value.value,
  set(enabled) {
    value.value = !!enabled;
    try {
      localStorage.setItem(key, String(value.value));
    } catch {
      // The setting still works for this tab when storage is unavailable.
    }
  },
});

export function useMapRenderSettings() {
  return { forceLod };
}
