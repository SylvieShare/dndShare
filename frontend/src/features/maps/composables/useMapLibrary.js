import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import {
  copyMap,
  deleteMap,
  getMap,
  getMaps,
  publishMap,
  rateMap,
  subscribeMap,
} from "@/shared/api/mapsApi";
import { availableMapTags, matchesMapTags } from "../lib/mapTags";
export function useMapLibrary(props, emit) {
  const router = useRouter(),
    maps = ref([]),
    scope = ref("own"),
    layout = ref("grid"),
    loading = ref(true),
    error = ref(""),
    query = ref(""),
    selectedTags = ref([]),
    preview = ref(null),
    pending = ref(null),
    confirming = ref(false),
    busy = ref(new Set());
  let request = 0;
  const filtered = computed(() =>
    maps.value.filter((m) =>
      matchesMapTags(m, query.value, selectedTags.value),
    ),
  );
  const tagOptions = computed(() =>
    availableMapTags(maps.value).map((tag) => ({ value: tag, label: tag })),
  );
  async function load(silent = false) {
    const generation = ++request;
    if (!silent) loading.value = true;
    error.value = "";
    try {
      const result = await getMaps(scope.value);
      if (generation === request) {
        maps.value = result;
        const tags = new Set(availableMapTags(result));
        selectedTags.value = selectedTags.value.filter((t) => tags.has(t));
      }
    } catch (cause) {
      if (generation === request)
        error.value =
          cause.status === 401
            ? "Войдите в аккаунт, чтобы работать с картами"
            : cause.message;
    } finally {
      if (generation === request) loading.value = false;
    }
  }
  async function act(map, operation) {
    if (busy.value.has(map.id)) return;
    busy.value.add(map.id);
    error.value = "";
    try {
      await operation();
      return true;
    } catch (cause) {
      error.value = cause.message;
      return false;
    } finally {
      busy.value.delete(map.id);
    }
  }
  async function open(map) {
    if (props.picker && (map.owned || map.subscribed)) {
      emit("select", map);
      return;
    }
    if (!map.publishedAt) {
      router.push({ name: "MapEditor", query: { id: map.id } });
      return;
    }
    preview.value = map;
    await act(map, async () => {
      const detail = await getMap(map.id);
      if (preview.value?.id === map.id) preview.value = detail;
    });
  }
  function create() {
    router.push({ name: "MapEditor" });
  }
  async function duplicate(map) {
    await act(map, async () => {
      const copy = await copyMap(map.id);
      await router.push({ name: "MapEditor", query: { id: copy.id } });
    });
  }
  async function subscription(map) {
    await act(map, async () => {
      const result = await subscribeMap(map.id, !map.subscribed);
      if (preview.value?.id === map.id) preview.value = result;
      await load(true);
    });
  }
  async function rate(map, rating) {
    await act(map, async () => {
      const result = await rateMap(map.id, rating);
      if (preview.value?.id === map.id) preview.value = result;
      await load(true);
    });
  }
  function confirm(kind, map) {
    pending.value = { kind, map };
  }
  async function apply() {
    if (!pending.value || confirming.value) return;
    confirming.value = true;
    const { kind, map } = pending.value;
    const applied = await act(map, async () => {
      if (kind === "publish") await publishMap(map.id, map.revision);
      else await deleteMap(map.id);
      await load(true);
    });
    if (applied) pending.value = null;
    confirming.value = false;
  }
  watch(scope, () => load());
  onMounted(() => load());
  return {
    maps,
    scope,
    layout,
    loading,
    error,
    query,
    selectedTags,
    preview,
    pending,
    confirming,
    busy,
    filtered,
    tagOptions,
    load,
    open,
    create,
    duplicate,
    subscription,
    rate,
    confirm,
    apply,
  };
}
