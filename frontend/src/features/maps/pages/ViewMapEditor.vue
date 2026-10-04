<template>
  <MapEditor
    v-if="map"
    :key="generation"
    ref="editor"
    :map="map"
    @close="router.push({ name: 'Maps' })"
    @saved="saved"
  />
  <main v-else class="map-editor-loading">
    <LoadingState v-if="loading" label="Открываем редактор…" />
    <template v-else>
      <p v-if="error" role="alert">{{ error }}</p>
      <p v-else role="status">Скоро будет</p>
      <ActionButton variant="secondary" @click="router.push({ name: 'Maps' })">
        <ArrowLeft :size="16" />К картам
      </ActionButton>
      <ActionButton v-if="error" variant="quiet" @click="load(route)">
        Повторить
      </ActionButton>
    </template>
  </main>
</template>
<script setup>
import { onMounted, ref } from "vue";
import {
  onBeforeRouteLeave,
  onBeforeRouteUpdate,
  useRoute,
  useRouter,
} from "vue-router";
import { ActionButton, LoadingState } from "@sylvieshare/share-ui";
import { ArrowLeft } from "@lucide/vue";
import { useAccountStore } from "@/stores/account";
import { getMaps } from "@/shared/api/mapsApi";
import { clone, KINDS, newMap } from "../lib/mapModel";
import MapEditor from "../components/MapEditor.vue";

const route = useRoute(),
  router = useRouter(),
  account = useAccountStore();
const map = ref(null),
  editor = ref(null),
  loading = ref(true),
  error = ref(""),
  generation = ref(0);
let recordId,
  leaving = false;
async function load(target) {
  loading.value = true;
  error.value = "";
  map.value = null;
  generation.value++;
  try {
    await account.ensureAuth();
    if (!account.hasRole("ADMIN")) return;
    const id = target.query.id || target.query.copy;
    if (id) {
      const source = (await getMaps()).find((m) => m.id === id);
      if (!source) throw new Error("Карта не найдена");
      const draft = clone(source);
      if (target.query.copy || draft.system) {
        delete draft.id;
        draft.system = false;
        draft.revision = 0;
        draft.name += " · копия";
      }
      map.value = draft;
    } else {
      const kind = Object.hasOwn(KINDS, target.query.kind)
        ? target.query.kind
        : "tiles";
      map.value = newMap(kind);
    }
    recordId = map.value.id;
  } catch (cause) {
    error.value = cause.message;
  } finally {
    loading.value = false;
  }
}
function saved(result) {
  recordId = result.id;
  if (!leaving && (route.query.id !== result.id || route.query.copy))
    router.replace({ name: "MapEditor", query: { id: result.id } });
}
async function prepareLeave() {
  leaving = true;
  try {
    return await (editor.value?.prepareLeave() ?? true);
  } finally {
    leaving = false;
  }
}
onBeforeRouteLeave(prepareLeave);
onBeforeRouteUpdate(async (to) => {
  // A first save assigns a URL without remounting or discarding newer local edits.
  if (to.query.id && to.query.id === recordId && !to.query.copy) return true;
  if (!(await prepareLeave())) return false;
  await load(to);
});
onMounted(() => load(route));
</script>
<style scoped>
.map-editor-loading {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  color: var(--text-muted);
}
</style>
