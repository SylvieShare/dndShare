<template>
  <section class="session-map-workspace" data-tutorial="session-map">
    <SessionMapTabsHeader
      :maps="headerMaps"
      :selected="c.selectedID"
      :on-air="c.display?.visible ? c.display.mapId : ''"
      :busy="c.loading || c.saving"
      @select="select"
      @rename="renaming = $event"
      @add="picker = true"
      ><SessionMapToolbar
        v-if="c.display"
        :editor="workspace?.editor"
        :controller="c"
        :screen-path="screenPath"
        @view="showBroadcastView"
        @capture="capture"
    /></SessionMapTabsHeader>
    <div
      id="session-map-content"
      class="session-map-content"
      role="tabpanel"
      :aria-labelledby="
        c.selectedID ? `session-map-tab-${c.selectedID}` : undefined
      "
    >
      <Transition name="session-map-page" mode="out-in">
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
          class="session-map-session-editor"
          :key="c.selected.id"
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
        :hovered-token="tokens.hovered"
        :rotate-token="tokens.rotate"
        :mirror-token="tokens.mirror"
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
      </Transition>
    </div>
    <SessionMapPicker
      v-if="picker"
      :uuid="sessionUuid"
      @close="picker = false"
      @add="add"
      @created="created"
    />
    <SessionMapTabDialog
      v-if="renaming"
      :key="renaming.id"
      :map="renaming"
      :save="rename"
      @close="renaming = null"
      @remove="requestRemove"
    />
    <ConfirmDialog
      v-if="pendingDelete"
      title="Убрать карту из сессии?"
      :message="`Копия карты «${pendingDelete.name}» и её расстановка будут удалены. Заготовка останется в библиотеке.`"
      confirm-label="Убрать"
      @confirm="remove"
      @cancel="pendingDelete = null"
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
import { computed, nextTick, reactive, ref, watch } from "vue";
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
import SessionMapTabsHeader from "./SessionMapTabsHeader.vue";
import SessionMapTabDialog from "./SessionMapTabDialog.vue";
import { useSessionMapBroadcast } from "../composables/useSessionMapBroadcast";
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
  pendingDelete = ref(null),
  renaming = ref(null);
const candidates = computed(() =>
  sessionCreatures(props.participants, props.encounter),
);
const headerMaps = computed(() =>
  c.maps.map((map) =>
    map.id === workspace.value?.editor?.draft.id
      ? { ...map, name: workspace.value.editor.draft.name }
      : map,
  ),
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
const { broadcastView, source, capture, showBroadcastView } =
  useSessionMapBroadcast(c, workspace, prepareLeave, select);
const screenPath = computed(
  () => `/map-screen/${props.session?.displayCode || ""}`,
);
watch(
  () => c.selectedID,
  (id) => {
    tokenDrag.cancel();
    tokens.reset();
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
  if (c.selectedID === id) return true;
  if (await prepareLeave()) {
    c.selectedID = id;
    picker.value = false;
    await nextTick();
    return true;
  }
  return false;
}
async function rename(id, name) {
  const editor = workspace.value?.editor;
  if (id === editor?.draft.id) {
    editor.change((map) => {
      map.name = name;
    });
    await editor.save();
    if (editor.dirty)
      throw new Error(
        editor.saveError || "Не удалось сохранить название карты",
      );
  } else {
    const map = c.maps.find((map) => map.id === id);
    if (!map) throw new Error("Карта уже удалена из сессии");
    await c.write({ ...map, name });
  }
}
function requestRemove(map) {
  renaming.value = null;
  pendingDelete.value = map;
}
async function add(map) {
  if ((await prepareLeave()) && (await c.add(map))) picker.value = false;
}
async function remove() {
  if ((await prepareLeave()) && c.remove(pendingDelete.value.id))
    pendingDelete.value = null;
}
async function created(map) {
  if (await prepareLeave()) {
    c.addImage(map);
    picker.value = false;
  }
}
defineExpose({
  prepareLeave,
  editor: computed(() => workspace.value?.editor),
  openReference: () => workspace.value?.openReference(),
});
</script>
<style scoped>
.session-map-workspace {
  display: flex;
  flex-direction: column;
  position: relative;
  height: 100%;
  min-height: 0;
  --map-focus-right: var(--chapter-safe-right, 12px);
}
.session-map-content {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
}
.session-map-content > .session-map-session-editor {
  height: 100%;
  min-height: 0;
}
.session-map-page-enter-active,
.session-map-page-leave-active {
  transition: opacity 150ms ease;
}
.session-map-page-enter-from,
.session-map-page-leave-to {
  opacity: 0;
}
.session-map-page-leave-active {
  pointer-events: none;
}
@media (prefers-reduced-motion: reduce) {
  .session-map-page-enter-active,
  .session-map-page-leave-active {
    transition: none;
  }
}
</style>
