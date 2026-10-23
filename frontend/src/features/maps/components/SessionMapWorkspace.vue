<template>
  <section class="session-map-workspace" data-tutorial="session-map">
    <LoadingState v-if="c.loading" label="Открываем карты сессии…" fill />
    <div v-else-if="!c.selected" class="map-empty">
      <Map :size="48" /><strong>Откройте карту сессии</strong
      ><span
        >Выберите заготовку и редактируйте её независимую копию в этой
        сессии.</span
      >
      <ActionButton @click="picker = true">Открыть новую</ActionButton>
    </div>
    <MapEditor
      v-else
      :key="`${c.selected.id}:${generation}`"
      ref="workspace"
      :map="c.selected"
      :save="c.write"
      :normalize="normalize"
      session-mode
      :embedded="integratedHeader"
      :active="active"
      :broadcast-view="broadcastView"
      :extra-tabs="tabs"
      :custom-focus="!!tokens.candidate"
      :custom-focus-key="tokens.focused"
      :selected-token="tokens.selected"
      :surface-placement="tokens.surface"
      :canvas-state="tokens.canvasState"
      :token-gesture="tokens.gesture"
      :remove-token="removeToken"
      @working="c.working"
      @broadcast-camera="source"
      @selection="clearTokens"
      @camera-move="tokenDrag.cameraMoved"
      @sidebar-resize="emit('inspector-resize', $event)"
    >
      <template #canvas-overlay="{ editor }"
        ><SessionMapToolbar
          :editor="editor"
          :controller="c"
          :screen-path="screenPath"
          @switch="picker = true"
          @view="showBroadcastView"
          @capture="capture"
      /></template>
      <template #creatures="{ editor }"
        ><SessionMapCreatures
          :editor="editor"
          :candidates="candidates"
          :selected="tokens.focused"
          @focus="focusCreature"
          @drag="dragCreature"
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
    <SessionMapPicker
      v-if="picker"
      :uuid="sessionUuid"
      :maps="c.maps"
      :selected="c.selectedID"
      @close="picker = false"
      @add="add"
      @created="created"
      @select="select"
      @remove="pendingDelete = $event"
    />
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
import { computed, reactive, ref, watch } from "vue";
import {
  ActionButton,
  ConfirmDialog,
  LoadingState,
} from "@sylvieshare/share-ui";
import { Map, UsersRound } from "@lucide/vue";
import { useSessionMaps } from "../composables/useSessionMaps";
import { sessionTokens } from "../composables/sessionTokens";
import { useCatalogueDrag } from "../composables/useCatalogueDrag";
import {
  sessionCreatures,
  withCreaturePortraits,
} from "../lib/sessionCreatures";
import { normalizeSessionMap } from "../lib/sessionMapState";
import MapEditor from "./MapEditor.vue";
import SessionMapCreatures from "./SessionMapCreatures.vue";
import SessionMapCreatureFocus from "./SessionMapCreatureFocus.vue";
import SessionMapToolbar from "./SessionMapToolbar.vue";
import SessionMapPicker from "./SessionMapPicker.vue";
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
  picker = ref(false),
  generation = ref(0),
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
const tokenDrag = useCatalogueDrag(
  {},
  computed(() => workspace.value?.canvas),
  {
    kind: "object",
    begin(item) {
      workspace.value?.canvas?.stopCamera();
      tokens.place(item);
      workspace.value?.editor?.pauseSave(true);
    },
    move(point) {
      if (workspace.value?.editor)
        tokens.gesture({ phase: "hover", point }, workspace.value.editor);
    },
    drop(point) {
      if (workspace.value?.editor)
        tokens.gesture({ phase: "start", point }, workspace.value.editor);
      this.cancel();
    },
    cancel() {
      if (workspace.value?.editor)
        tokens.gesture({ phase: "cancel" }, workspace.value.editor);
    },
  },
);
function focusCreature(item) {
  tokenDrag.cancel();
  tokens.focus(item);
}
function dragCreature(item, event) {
  workspace.value?.cancelPlacement();
  tokenDrag.begin(item, event, {
    threshold: 5,
    click: () => tokens.focus(item),
  });
}
function clearTokens() {
  tokenDrag.cancel();
  tokens.clear();
}
watch(
  () => props.active,
  (active) => {
    if (!active) tokenDrag.cancel();
  },
);
const tabs = [{ key: "creatures", label: "Существа", icon: UsersRound }];
const broadcastView = computed(() =>
  c.display?.mapId === c.selectedID && !c.display.camera.sceneId
    ? c.display.camera.view
    : null,
);
const screenPath = computed(
  () => `/map-screen/${props.session?.displayCode || ""}`,
);
watch(
  () => c.selectedID,
  (id) => {
    tokenDrag.cancel();
    tokens.reset();
    if (id && c.display && c.display.mapId !== id)
      c.updateDisplay({
        mapId: id,
        camera: {
          ...c.display.camera,
          sceneId: "",
          view: null,
          fit: true,
          x: c.selected.document.width / 2,
          y: c.selected.document.height / 2,
        },
      });
  },
);
function normalize(map, catalogue) {
  normalizeSessionMap(map, catalogue);
  map.state.tokens = withCreaturePortraits(map.state.tokens, candidates.value);
}
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
    picker.value = false;
  }
}
async function add(map) {
  if ((await prepareLeave()) && (await c.add(map))) picker.value = false;
}
async function remove() {
  if ((await prepareLeave()) && c.remove(pendingDelete.value.id))
    pendingDelete.value = null;
}
async function reload() {
  reloadConfirm.value = false;
  c.editing = false;
  await c.load(true);
  generation.value++;
  tokens.reset();
}
async function created(map) {
  if (await prepareLeave()) {
    c.addImage(map);
    picker.value = false;
  }
}
async function source(id) {
  if (!(await prepareLeave())) return;
  const camera = c.selected.document.cameras?.find((c) => c.id === id);
  if (id === "virtual") return;
  c.updateDisplay({
    mapId: c.selectedID,
    camera: {
      ...c.display.camera,
      fit: !camera,
      sceneId: camera?.id || "",
      view: camera?.view || null,
    },
  });
}
function showBroadcastView() {
  const camera = c.display?.camera;
  const saved = c.selected.document.cameras?.find(
    (item) => item.id === camera?.sceneId,
  );
  const view = saved?.view || camera?.view;
  if (view) workspace.value?.canvas?.lookThrough(view);
  else workspace.value?.canvas?.fit();
}
async function capture() {
  const view = workspace.value?.canvas?.captureCamera();
  if (view && (await prepareLeave()))
    c.updateDisplay({
      mapId: c.selectedID,
      camera: { ...c.display.camera, fit: false, sceneId: "", view },
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
