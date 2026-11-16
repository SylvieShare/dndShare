import { computed, onMounted, ref, watch, unref } from "vue";
import { fetchGet } from "@/shared/api/http";
import { redCatalogueItem } from "../settings/cyberpunk-red/equipment";
import { useAccountStore } from "@/stores/account";
const pendingByAccount = new Map();
export function useRedCatalogue(enabled = true) {
  const items = ref([]),
    loading = ref(true),
    error = ref("");
  async function load() {
    loading.value = true;
    error.value = "";
    try {
      const key = useAccountStore().user?.id || "guest";
      let pending = pendingByAccount.get(key);
      if (!pending) {
        pending = fetchGet("/cyberpunk-red/catalogue");
        pendingByAccount.set(key, pending);
      }
      let result;
      try {
        result = await pending;
      } finally {
        if (pendingByAccount.get(key) === pending) pendingByAccount.delete(key);
      }
      items.value = (result.items || []).map(redCatalogueItem);
    } catch (e) {
      error.value = e?.message || "Не удалось загрузить справочник RED";
    } finally {
      loading.value = false;
    }
  }
  onMounted(() => {
    if (unref(enabled)) load();
    else loading.value = false;
  });
  watch(
    () => unref(enabled),
    (value) => {
      if (value) load();
    },
  );
  return {
    items,
    loading,
    error,
    load,
    byKey: computed(() =>
      Object.fromEntries(items.value.map((i) => [i.key, i])),
    ),
  };
}
