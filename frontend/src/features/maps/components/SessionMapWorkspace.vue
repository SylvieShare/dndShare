<template>
  <section class="session-map-workspace" data-tutorial="session-map">
    <header class="map-toolbar">
      <Map :size="24" /><strong>Карта</strong>
      <FormSelect
        v-if="c.maps.length"
        :value="c.selectedID"
        aria-label="Карта сессии"
        :disabled="c.editing"
        @change="c.selectedID = $event"
        ><option v-for="m in c.maps" :key="m.id" :value="m.id">
          {{ m.name
          }}{{
            c.display?.mapId === m.id && c.display.visible
              ? " · в трансляции"
              : ""
          }}
        </option></FormSelect
      >
      <ActionButton
        variant="secondary"
        aria-label="Добавить карту"
        title="Добавить карту"
        @click="picker = true"
        ><Plus :size="16" /><span class="session-map-action-label"
          >Добавить карту</span
        ></ActionButton
      >
      <template v-if="c.selected">
        <ActionButton
          :disabled="c.displaySaving || c.conflict"
          aria-label="Транслировать карту"
          title="Транслировать карту"
          @click="broadcast"
          ><MonitorUp :size="16" /><span class="session-map-action-label"
            >Транслировать карту</span
          ></ActionButton
        >
        <ActionButton
          variant="quiet"
          title="Убрать карту из сессии"
          :disabled="c.saving"
          @click="pendingDelete = c.selected"
          ><Trash2 :size="16"
        /></ActionButton>
      </template>
      <span class="map-save-status" role="status">{{
        c.error
          ? "Есть ошибка"
          : c.saving
            ? "Сохраняем…"
            : c.connected
              ? "Синхронизировано"
              : "Восстанавливаем связь"
      }}</span>
    </header>
    <div v-if="c.error" class="map-error" role="alert">
      {{ c.error
      }}<ActionButton
        variant="quiet"
        :disabled="c.saving"
        @click="c.conflict ? (reloadConfirm = true) : c.retry()"
        >{{ c.conflict ? "Загрузить с сервера" : "Повторить" }}</ActionButton
      >
    </div>
    <LoadingState v-if="c.loading" label="Открываем карты сессии…" />
    <div v-else-if="!c.selected" class="map-empty">
      <Map :size="48" /><strong>Добавьте карту сессии</strong
      ><span
        >Добавьте карту из библиотеки. Её туман, двери и жетоны будут сохранены
        в этой сессии.</span
      ><ActionButton @click="picker = true">Выбрать карту</ActionButton>
    </div>
    <div v-else class="session-map-editor">
      <SessionMapInspector
        :controller="c"
        :candidates="candidates"
        :selected-token="selectedToken"
        :pending="pendingToken"
        :screen-path="screenPath"
        @place="
          pendingToken = $event;
          tool = 'select';
        "
        @token="
          selectedToken = $event;
          tool = 'select';
        "
        @zone="selectedZone = $event"
        @frame="frame"
        @resize="inspectorWidth = $event"
      />
      <div class="session-map-main">
        <div class="map-toolbar">
          <ActionButton
            :variant="tool === 'select' ? 'primary' : 'secondary'"
            @click="tool = 'select'"
            ><MousePointer2 :size="15" />Жетоны и двери</ActionButton
          >
          <ActionButton
            :variant="tool === 'pan' ? 'primary' : 'secondary'"
            @click="
              tool = 'pan';
              pendingToken = null;
            "
            ><Hand :size="15" />Обзор</ActionButton
          >
          <ToggleSwitch v-model="playerPreview" label="Вид игроков" />
          <span v-if="pendingToken" class="map-hint"
            >Поставить: {{ pendingToken.name }}
            <ActionButton variant="quiet" @click="pendingToken = null"
              >Отмена</ActionButton
            ></span
          >
        </div>
        <MapCanvas
          :area-mode="playerPreview ? 'hide' : 'ghost'"
          :key="c.selected.id"
          ref="canvas"
          :document="c.selected.document"
          :state="c.selected.state"
          :surface-placement="!!pendingToken || !!drag?.token"
          :master="!playerPreview"
          :readonly="c.conflict"
          :tool="tool"
          :selected-zone="selectedZone"
          :selected-token="selectedToken"
          @gesture="gesture"
        />
      </div>
    </div>
    <AppModalFrame
      v-if="picker"
      title="Добавить карту в сессию"
      width="1100px"
      close-label="Закрыть"
      @close="picker = false"
      ><MapLibrary picker @select="add"
    /></AppModalFrame>
    <ConfirmDialog
      v-if="pendingDelete"
      title="Убрать карту из сессии?"
      :message="`Расстановка, двери и туман карты «${pendingDelete.name}» будут удалены. Исходная карта останется в библиотеке.`"
      confirm-label="Убрать"
      @confirm="remove"
      @cancel="pendingDelete = null"
    />
    <ConfirmDialog
      v-if="reloadConfirm"
      title="Загрузить состояние с сервера?"
      message="Ваши несохранённые действия на карте будут отменены."
      confirm-label="Загрузить"
      @confirm="
        c.load(true).catch(() => {});
        reloadConfirm = false;
      "
      @cancel="reloadConfirm = false"
    />
    <ConfirmDialog
      v-if="leaveConfirm"
      title="Остались несохранённые действия"
      message="Не удалось сохранить изменения карты. Можно остаться и повторить сохранение или уйти с потерей этих изменений."
      confirm-label="Уйти без сохранения"
      cancel-label="Остаться"
      @confirm="finishLeave(true)"
      @cancel="finishLeave(false)"
    />
  </section>
</template>
<script setup>
import "../styles/maps.css";
import { computed, reactive, ref, watch } from "vue";
import {
  ActionButton,
  AppModalFrame,
  ConfirmDialog,
  FormSelect,
  LoadingState,
  ToggleSwitch,
} from "@sylvieshare/share-ui";
import { Hand, Map, MonitorUp, MousePointer2, Plus, Trash2 } from "@lucide/vue";
import { pvAvatar, pvName } from "@/features/sessions/lib/participantView";
import { useSessionMaps } from "../composables/useSessionMaps";
import { clone, inside, interactive, snap, uid } from "../lib/mapModel";
import MapCanvas from "./MapCanvas.vue";
import MapLibrary from "./MapLibrary.vue";
import SessionMapInspector from "./SessionMapInspector.vue";
const props = defineProps({
  sessionUuid: { type: String, required: true },
  session: Object,
  participants: { type: Array, default: () => [] },
  encounter: Object,
});
const emit = defineEmits(["inspector-resize"]);
const inspectorWidth = ref(334);
const c = reactive(useSessionMaps(props.sessionUuid)),
  picker = ref(false),
  pendingDelete = ref(null),
  reloadConfirm = ref(false),
  canvas = ref(null);
const leaveConfirm = ref(false);
let resolveLeave;
async function prepareLeave() {
  await c.flush();
  if (!c.hasPending()) return true;
  leaveConfirm.value = true;
  return new Promise((resolve) => {
    resolveLeave = resolve;
  });
}
function finishLeave(leave) {
  leaveConfirm.value = false;
  resolveLeave?.(leave);
}
defineExpose({ prepareLeave });
const selectedToken = ref(""),
  selectedZone = ref(""),
  pendingToken = ref(null),
  tool = ref("select"),
  playerPreview = ref(false);
const screenPath = computed(
  () => `/map-screen/${props.session?.displayCode || ""}`,
);
const candidates = computed(() => [
  ...props.participants.map((p) => ({
    kind: "player",
    ref: String(p.charId),
    name: pvName(p) || "Персонаж",
    imageUrl: pvAvatar(p) || "",
    color: p.color || "#a797d4",
  })),
  ...(props.encounter?.encounter?.combatants || [])
    .filter((n) => n.type === "npc")
    .map((n) => ({
      kind: "creature",
      ref: n.uid,
      name: `${n.markerLetter ? n.markerLetter + " · " : ""}${props.encounter.npcName(n)}`,
      imageUrl: props.encounter.npcItem(n)?.iconImageUrl || "",
      color: n.iconColor || "#c18f6f",
    })),
]);
let drag = null;
watch(
  () => [!!c.selected, inspectorWidth.value],
  ([selected, width]) => emit("inspector-resize", selected ? width : 0),
  { immediate: true },
);
watch(
  () => c.selectedID,
  () => {
    selectedToken.value = "";
    selectedZone.value = "";
    pendingToken.value = null;
    drag = null;
  },
);
async function add(map) {
  if (await c.add(map)) picker.value = false;
}
async function remove() {
  if (await c.remove(pendingDelete.value.id)) pendingDelete.value = null;
}
function broadcast() {
  const d = c.selected.document;
  return c.updateDisplay({
    mapId: c.selected.id,
    visible: true,
    camera:
      c.display?.mapId === c.selected.id
        ? c.display.camera
        : {
            x: d.width / 2,
            y: d.height / 2,
            cellPixels: 64,
            rotation: 0,
            fit: true,
          },
  });
}
function frame() {
  const view = canvas.value?.getView();
  if (view)
    c.updateDisplay({
      camera: { ...c.display.camera, x: view.x, y: view.y, fit: false },
    });
}
function gesture({ phase, point, hit }) {
  const m = c.selected;
  if (!m || c.conflict || playerPreview.value) return;
  if (phase === "hover") return;
  if (phase === "cancel") {
    if (drag?.before) m.state = drag.before;
    drag = null;
    c.editing = false;
    return;
  }
  if (phase === "start") {
    if (!inside(m.document, point.x, point.y) && (!hit || pendingToken.value))
      return;
    if (pendingToken.value) {
      if (!point.placement) return;
      const token = {
        ...pendingToken.value,
        id: uid(),
        ...(point.placement ? point : snap(m.document, point)),
        size: 1,
        hidden: false,
        physical: false,
      };
      c.change((s) => s.tokens.push(token));
      selectedToken.value = token.id;
      pendingToken.value = null;
      return;
    }
    const token = hit?.tokenId
      ? m.state.tokens.find((t) => t.id === hit.tokenId)
      : [...m.state.tokens]
          .reverse()
          .find(
            (t) =>
              Math.abs(t.x - point.x) <= t.size / 2 &&
              Math.abs(t.y - point.y) <= t.size / 2,
          );
    selectedToken.value = token?.id || "";
    drag = {
      start: point,
      token: token?.id,
      object: hit?.objectId,
      before: clone(m.state),
    };
    c.editing = true;
  } else if (phase === "move" && drag?.token) {
    const token = m.state.tokens.find((t) => t.id === drag.token);
    if (point.placement)
      Object.assign(
        token,
        point.placement ? point : snap(m.document, point, token.size),
      );
  } else if (phase === "end" && drag) {
    if (drag.token) c.persist();
    else if (Math.hypot(point.x - drag.start.x, point.y - drag.start.y) < 0.3) {
      const o = drag.object
        ? m.document.objects.find(
            (o) => o.id === drag.object && interactive(o.kind),
          )
        : [...m.document.objects]
            .reverse()
            .find(
              (o) =>
                interactive(o.kind) &&
                Math.hypot(o.x - point.x, o.y - point.y) < o.scale * 0.7,
            );
      if (o)
        c.change((s) => {
          s.objects[o.id] = !(s.objects[o.id] ?? o.open);
        });
    }
    drag = null;
    c.editing = false;
  }
}
</script>
<style scoped>
.session-map-workspace {
  position: relative;
  height: 100%;
  min-height: 0;
}
.session-map-workspace > .map-toolbar,
.session-map-main > .map-toolbar {
  position: absolute;
  z-index: 7;
  top: 14px;
  left: max(14px, var(--chapter-safe-left, 362px));
  right: var(--chapter-safe-right, 86px);
  padding: 8px;
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  background: var(--surface);
}
.session-map-workspace > .map-toolbar > select {
  flex: 1;
  min-width: 100px;
  max-width: 240px;
}
.session-map-workspace > .map-toolbar > strong {
  display: none;
}
.session-map-workspace > .map-toolbar > svg {
  display: none;
}
.session-map-main > .map-toolbar {
  top: auto;
  bottom: 14px;
  right: auto;
  max-width: calc(100% - var(--chapter-safe-left, 362px) - 100px);
}
.session-map-editor,
.session-map-main {
  position: absolute;
  inset: 0;
  min-width: 0;
  min-height: 0;
}
.session-map-main > :deep(.map-canvas) {
  border-radius: 0;
}
.session-map-main :deep(.map-controls-hint) {
  left: var(--chapter-safe-left, 362px);
  bottom: 76px;
}
.session-map-main :deep(.map-canvas-controls) {
  right: calc(var(--chapter-safe-right, 0px) + 14px);
}
.session-map-workspace > .map-error {
  position: absolute;
  z-index: 9;
  top: 68px;
  left: var(--chapter-safe-left, 362px);
  right: var(--chapter-safe-right, 14px);
}
.session-map-workspace > .map-empty,
.session-map-workspace > :deep(.loading-state) {
  position: absolute;
  top: 90px;
  bottom: 0;
  left: var(--chapter-safe-left, 362px);
  right: var(--chapter-safe-right, 14px);
}
@media (max-width: 1400px) {
  .session-map-action-label {
    display: none;
  }
}
@media (max-width: 760px) {
  .session-map-workspace > .map-toolbar {
    left: 76px;
    right: 14px;
    flex-wrap: wrap;
  }
  .session-map-main > .map-toolbar {
    left: 76px;
    bottom: 76px;
    max-width: calc(100% - 100px);
  }
}
</style>
