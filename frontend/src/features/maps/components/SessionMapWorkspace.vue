<template>
  <section class="session-map-workspace" data-tutorial="session-map">
    <LoadingState v-if="c.loading" label="Открываем карты сессии…" fill />
    <div v-else-if="!c.selected" class="map-empty">
      <Map :size="48" /><strong>Откройте карту сессии</strong
      ><span
        >Выберите заготовку и редактируйте её независимую копию в этой
        сессии.</span
      >
      <ActionButton @click="picker = 'library'">Открыть новую</ActionButton>
    </div>
    <MapEditor
      v-else
      :key="`${c.selected.id}:${generation}`"
      ref="workspace"
      :map="c.selected"
      :save="c.write"
      :normalize="normalizeSessionMap"
      session-mode
      :embedded="integratedHeader"
      :active="active"
      :extra-tabs="tabs"
      :custom-focus="!!tokens.candidate"
      :selected-token="tokens.selected"
      :surface-placement="tokens.surface"
      :canvas-state="tokens.canvasState"
      :player-preview="playerPreview"
      :token-gesture="tokens.gesture"
      :remove-token="removeToken"
      @working="c.working"
      @selection="tokens.clear"
      @sidebar-resize="emit('inspector-resize', $event)"
    >
      <template #session-settings="{ editor }">
        <SessionMapSettings
          :editor="editor"
          :controller="c"
          :source-map="sourceMap"
          :screen-path="screenPath"
          :player-preview="playerPreview"
          @switch="picker = 'session'"
          @open="picker = 'library'"
          @preview="playerPreview = $event"
          @frame="frame"
          @remove="pendingDelete = c.selected"
          @reload="reloadConfirm = true"
        />
      </template>
      <template #creatures="{ editor }"
        ><SessionMapCreatures
          :editor="editor"
          :candidates="candidates"
          :selected="tokens.focused"
          @focus="tokens.focus"
          @place="tokens.place"
      /></template>
      <template #focus="{ editor }"
        ><SessionMapCreatureFocus
          v-if="tokens.candidate"
          :editor="editor"
          :tokens="tokens"
          :candidate="tokens.candidate"
          :token="tokens.token"
          :encounter="encounter"
          @participant="emit('participant', $event)"
      /></template>
    </MapEditor>
    <AppModalFrame
      v-if="picker"
      :title="
        picker === 'library' ? 'Открыть новую карту' : 'Переключить карту'
      "
      :width="1100"
      close-label="Закрыть выбор карты"
      @close="picker = ''"
    >
      <MapLibrary v-if="picker === 'library'" picker @select="add" />
      <div v-else class="session-map-choices">
        <BaseTile
          v-for="map in c.maps"
          :key="map.id"
          interactive
          framed
          :tint="map.id === c.selectedID"
          role="button"
          tabindex="0"
          :aria-label="map.name"
          @click="select(map.id)"
          @keydown.enter="select(map.id)"
        >
          <MapEntityRow
            :entry="{ kind: 'map', name: map.name }"
            :selectable="false"
          /><small class="map-hint">{{ map.source?.name }}</small>
        </BaseTile>
      </div>
    </AppModalFrame>
    <ConfirmDialog
      v-if="pendingDelete"
      title="Убрать карту из сессии?"
      :message="`Копия карты «${pendingDelete.name}» и её расстановка будут удалены. Заготовка останется в библиотеке.`"
      confirm-label="Убрать"
      @confirm="remove"
      @cancel="pendingDelete = null"
    />
    <ConfirmDialog
      v-if="reloadConfirm"
      title="Загрузить карту с сервера?"
      message="Несохранённые изменения будут отменены."
      confirm-label="Загрузить"
      @confirm="reload"
      @cancel="reloadConfirm = false"
    />
    <div
      v-if="c.error && !workspace?.editor?.saveError"
      class="map-error"
      role="alert"
    >
      {{ c.error }}
    </div>
  </section>
</template>
<script setup>
import "../styles/maps.css";
import { computed, onMounted, reactive, ref, watch } from "vue";
import {
  ActionButton,
  AppModalFrame,
  BaseTile,
  ConfirmDialog,
  LoadingState,
} from "@sylvieshare/share-ui";
import { Map, Settings, UsersRound } from "@lucide/vue";
import { getMaps } from "@/shared/api/mapsApi";
import { useSessionMaps } from "../composables/useSessionMaps";
import { sessionTokens } from "../composables/sessionTokens";
import { sessionCreatures } from "../lib/sessionCreatures";
import { normalizeSessionMap } from "../lib/sessionMapState";
import MapEditor from "./MapEditor.vue";
import MapLibrary from "./MapLibrary.vue";
import MapEntityRow from "./MapEntityRow.vue";
import SessionMapCreatures from "./SessionMapCreatures.vue";
import SessionMapCreatureFocus from "./SessionMapCreatureFocus.vue";
import SessionMapSettings from "./SessionMapSettings.vue";
const props = defineProps({
  sessionUuid: { type: String, required: true },
  session: Object,
  participants: { type: Array, default: () => [] },
  encounter: Object,
  integratedHeader: Boolean,
  active: { type: Boolean, default: true },
});
const emit = defineEmits(["inspector-resize", "participant"]);
const c = reactive(useSessionMaps(props.sessionUuid)),
  workspace = ref(null),
  picker = ref(""),
  templates = ref([]),
  generation = ref(0),
  playerPreview = ref(false),
  pendingDelete = ref(null),
  reloadConfirm = ref(false);
const candidates = computed(() =>
  sessionCreatures(props.participants, props.encounter),
);
const tokens = reactive(
  sessionTokens(
    () => workspace.value?.editor,
    candidates,
    () => workspace.value?.canvas,
  ),
);
const tabs = [
  {
    key: "session-settings",
    label: "Настройки",
    icon: Settings,
  },
  { key: "creatures", label: "Существа", icon: UsersRound },
];
const sourceMap = computed(() =>
  templates.value.find((m) => m.id === c.selected?.source?.id),
);
const screenPath = computed(
  () => `/map-screen/${props.session?.displayCode || ""}`,
);
onMounted(() =>
  getMaps()
    .then((maps) => {
      templates.value = maps;
    })
    .catch(() => {}),
);
watch(
  () => c.selectedID,
  (id) => {
    tokens.reset();
    playerPreview.value = false;
    if (id && c.display && c.display.mapId !== id)
      c.updateDisplay({
        mapId: id,
        camera: {
          ...c.display.camera,
          x: c.selected.document.width / 2,
          y: c.selected.document.height / 2,
        },
      });
  },
);
function removeToken() {
  if (!tokens.token) return false;
  tokens.remove();
  return true;
}
async function prepareLeave() {
  return (await workspace.value?.prepareLeave()) ?? true;
}
async function select(id) {
  if (await prepareLeave()) {
    c.selectedID = id;
    picker.value = "";
  }
}
async function add(map) {
  if ((await prepareLeave()) && (await c.add(map))) picker.value = "";
}
async function remove() {
  if ((await prepareLeave()) && (await c.remove(pendingDelete.value.id)))
    pendingDelete.value = null;
}
async function reload() {
  reloadConfirm.value = false;
  c.editing = false;
  await c.load(true);
  generation.value++;
  tokens.reset();
}
function frame() {
  const view = workspace.value?.canvas?.getView();
  if (view)
    c.updateDisplay({
      camera: { ...c.display.camera, x: view.x, y: view.y, fit: false },
    });
}
defineExpose({
  prepareLeave,
  editor: computed(() => workspace.value?.editor),
  openReference: () => workspace.value?.openReference(),
});
</script>
<style scoped>
.session-map-workspace {
  position: relative;
  height: 100%;
  min-height: 0;
  --map-focus-right: var(--chapter-safe-right, 12px);
}
.session-map-choices {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 14px;
}
</style>
