<template>
  <div class="map-library">
    <div class="map-library-toolbar">
      <FormTextInput
        v-model:value="query"
        placeholder="Название или тег…"
        aria-label="Поиск карт"
      />
      <MultiToggle
        v-model="filter"
        :options="[
          { value: 'all', label: 'Все' },
          { value: 'own', label: 'Мои' },
          { value: 'system', label: 'Системные' },
        ]"
        aria-label="Источник карт"
      />
      <SearchMultiSelect
        v-model="selectedTags"
        :options="tagOptions"
        label="Теги карт"
        placeholder="Найти тег…"
        empty-label="Теги не найдены"
        remove-label="Убрать тег"
      />
      <ActionButton v-if="!picker" @click="create"
        ><Plus :size="17" />Создать карту</ActionButton
      >
    </div>
    <div v-if="error" class="map-error" role="alert">
      {{ error }}
      <ActionButton variant="quiet" @click="load">Повторить</ActionButton>
    </div>
    <LoadingState v-if="loading" label="Загружаем карты…" />
    <div v-else-if="!filtered.length" class="map-empty">
      <Map :size="40" /><strong>Карт пока нет</strong
      ><span>Создайте карту или выберите системную.</span>
    </div>
    <div v-else class="map-library-grid">
      <BaseTile
        v-for="map in filtered"
        :key="map.id"
        padding="12px"
        class="map-library-card"
      >
        <button
          class="map-library-preview"
          type="button"
          :aria-label="`${picker ? 'Выбрать' : 'Открыть'} карту ${map.name}`"
          @click="open(map)"
        >
          <MapThumbnail :document="map.document" /><span
            class="map-library-name"
            >{{ map.name }}</span
          >
        </button>
        <span class="map-library-meta"
          >3D-карта · {{ map.document.width }} × {{ map.document.height }} ·
          {{ map.document.tiles.length }} плиток</span
        >
        <div class="map-library-tags" aria-label="Теги карты">
          <span v-for="tag in map.document.tags" :key="tag">{{ tag }}</span>
        </div>
        <div class="map-library-actions">
          <span class="map-library-badge">{{
            map.system ? "Системная" : "Моя карта"
          }}</span>
          <ActionButton
            v-if="!picker"
            variant="quiet"
            :title="map.system ? 'Создать свою копию' : 'Дублировать карту'"
            @click="duplicate(map)"
            ><Copy :size="15"
          /></ActionButton>
          <ActionButton
            v-if="!picker && !map.system"
            variant="quiet"
            title="Удалить карту"
            @click="pendingDelete = map"
            ><Trash2 :size="15"
          /></ActionButton>
          <ActionButton
            v-if="picker"
            variant="secondary"
            @click="emit('select', map)"
            >Выбрать</ActionButton
          >
        </div>
      </BaseTile>
    </div>
    <AppModalFrame
      v-if="preview"
      :title="preview.name"
      fullscreen
      :padded="false"
      :body-scroll="false"
      close-label="Закрыть"
      @close="preview = null"
    >
      <template #header-actions
        ><ActionButton
          @click="
            duplicate(preview);
            preview = null;
          "
          ><Copy :size="16" />Создать свою копию</ActionButton
        ></template
      >
      <MapCanvas :document="preview.document" master />
    </AppModalFrame>
    <ConfirmDialog
      v-if="pendingDelete"
      title="Удалить карту?"
      :message="`«${pendingDelete.name}» исчезнет из библиотеки. Копии в сессиях сохранятся.`"
      confirm-label="Удалить"
      :loading="deleting"
      @confirm="remove"
      @cancel="pendingDelete = null"
    />
  </div>
</template>
<script setup>
import "../styles/maps.css";
import { computed, defineAsyncComponent, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import {
  ActionButton,
  AppModalFrame,
  BaseTile,
  ConfirmDialog,
  FormTextInput,
  LoadingState,
  MultiToggle,
  SearchMultiSelect,
} from "@sylvieshare/share-ui";
import { Copy, Map, Plus, Trash2 } from "@lucide/vue";
import { deleteMap, getMaps } from "@/shared/api/mapsApi";
import { availableMapTags, matchesMapTags } from "../lib/mapTags";
import MapThumbnail from "./MapThumbnail.vue";
const MapCanvas = defineAsyncComponent(() => import("./MapCanvas.vue"));
const props = defineProps({ picker: Boolean }),
  emit = defineEmits(["select"]);
const maps = ref([]),
  loading = ref(true),
  error = ref(""),
  query = ref(""),
  filter = ref("all"),
  selectedTags = ref([]),
  preview = ref(null),
  pendingDelete = ref(null),
  deleting = ref(false);
const router = useRouter();
const filtered = computed(() =>
  maps.value.filter(
    (m) =>
      (filter.value === "all" || m.system === (filter.value === "system")) &&
      matchesMapTags(m, query.value, selectedTags.value),
  ),
);
const tags = computed(() => availableMapTags(maps.value));
const tagOptions = computed(() =>
  tags.value.map((tag) => ({ value: tag, label: tag })),
);
watch(tags, (values) => {
  selectedTags.value = selectedTags.value.filter((tag) => values.includes(tag));
});
async function load() {
  loading.value = true;
  error.value = "";
  try {
    maps.value = await getMaps();
  } catch (cause) {
    error.value =
      cause.status === 401
        ? "Войдите в аккаунт, чтобы работать с картами"
        : cause.message;
  } finally {
    loading.value = false;
  }
}
function open(map) {
  if (props.picker) emit("select", map);
  else if (map.system) preview.value = map;
  else router.push({ name: "MapEditor", query: { id: map.id } });
}
function duplicate(map) {
  router.push({ name: "MapEditor", query: { copy: map.id } });
}
function create() {
  router.push({ name: "MapEditor" });
}
async function remove() {
  deleting.value = true;
  try {
    await deleteMap(pendingDelete.value.id);
    maps.value = maps.value.filter((m) => m.id !== pendingDelete.value.id);
    pendingDelete.value = null;
  } catch (cause) {
    error.value = cause.message;
  } finally {
    deleting.value = false;
  }
}
onMounted(load);
</script>
<style scoped>
.map-library {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 22px;
}
.map-library-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.map-library-toolbar > input {
  max-width: 300px;
}
.map-library-toolbar > .share-action-button {
  margin-left: auto;
}
.map-library-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 18px;
}
.map-library-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.map-library-preview {
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.map-library-preview:hover .map-library-name {
  color: var(--accent);
}
.map-library-name {
  display: block;
  margin-top: 15px;
  font-family: var(--font-display);
  font-size: 20px;
  color: var(--text-1);
}
.map-library-meta {
  color: var(--text-muted);
  font-size: 11px;
}
.map-library-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
.map-library-badge {
  margin-right: auto;
  color: var(--text-muted);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.map-library-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  color: var(--text-muted);
  font-size: 11px;
}
</style>
