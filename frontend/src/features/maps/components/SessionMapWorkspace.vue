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
          {{ m.name }}{{ c.display?.mapId === m.id && c.display.visible ? ' · на столе' : '' }}
        </option></FormSelect
      >
      <ActionButton variant="secondary" @click="picker = true"
        ><Plus :size="16" />Добавить карту</ActionButton
      >
      <template v-if="c.selected">
        <ActionButton :disabled="c.displaySaving || c.conflict" @click="broadcast"
          ><MonitorUp :size="16" />Транслировать карту</ActionButton
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
          ? 'Есть ошибка'
          : c.saving
            ? 'Сохраняем…'
            : c.connected
              ? 'Синхронизировано'
              : 'Восстанавливаем связь'
      }}</span>
    </header>
    <div v-if="c.error" class="map-error" role="alert">
      {{ c.error
      }}<ActionButton
        variant="quiet"
        :disabled="c.saving"
        @click="c.conflict ? (reloadConfirm = true) : c.retry()"
        >{{ c.conflict ? 'Загрузить с сервера' : 'Повторить' }}</ActionButton
      >
    </div>
    <LoadingState v-if="c.loading" label="Открываем карты сессии…" />
    <div v-else-if="!c.selected" class="map-empty">
      <Map :size="48" /><strong>Подготовьте игровой стол</strong
      ><span
        >Добавьте карту из библиотеки. Её туман, двери и жетоны будут сохранены в этой сессии.</span
      ><ActionButton @click="picker = true">Выбрать карту</ActionButton>
    </div>
    <div v-else class="map-editor session-map-editor">
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
      />
      <div class="map-editor-main">
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
            <ActionButton variant="quiet" @click="pendingToken = null">Отмена</ActionButton></span
          >
          <span v-else class="map-toolbar-note">Перетащите жетон · нажмите на дверь</span>
        </div>
        <MapCanvas
          :key="c.selected.id"
          ref="canvas"
          :document="c.selected.document"
          :state="c.selected.state"
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
import '../styles/maps.css';
import { computed, reactive, ref, watch } from 'vue';
import {
  ActionButton,
  AppModalFrame,
  ConfirmDialog,
  FormSelect,
  LoadingState,
  ToggleSwitch,
} from '@sylvieshare/share-ui';
import { Hand, Map, MonitorUp, MousePointer2, Plus, Trash2 } from '@lucide/vue';
import { pvAvatar, pvName } from '@/features/sessions/lib/participantView';
import { useSessionMaps } from '../composables/useSessionMaps';
import { clone, inside, interactive, snap, uid } from '../lib/mapModel';
import MapCanvas from './MapCanvas.vue';
import MapLibrary from './MapLibrary.vue';
import SessionMapInspector from './SessionMapInspector.vue';
const props = defineProps({
  sessionUuid: { type: String, required: true },
  session: Object,
  participants: { type: Array, default: () => [] },
  encounter: Object,
});
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
const selectedToken = ref(''),
  selectedZone = ref(''),
  pendingToken = ref(null),
  tool = ref('select'),
  playerPreview = ref(false);
const screenPath = computed(() => `/map-screen/${props.session?.displayCode || ''}`);
const candidates = computed(() => [
  ...props.participants.map((p) => ({
    kind: 'player',
    ref: String(p.charId),
    name: pvName(p) || 'Персонаж',
    imageUrl: pvAvatar(p) || '',
    color: p.color || '#a797d4',
  })),
  ...(props.encounter?.encounter?.combatants || [])
    .filter((n) => n.type === 'npc')
    .map((n) => ({
      kind: 'creature',
      ref: n.uid,
      name: `${n.markerLetter ? n.markerLetter + ' · ' : ''}${props.encounter.npcName(n)}`,
      imageUrl: props.encounter.npcItem(n)?.iconImageUrl || '',
      color: n.iconColor || '#c18f6f',
    })),
]);
let drag = null;
watch(
  () => c.selectedID,
  () => {
    selectedToken.value = '';
    selectedZone.value = '';
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
        : { x: d.width / 2, y: d.height / 2, cellPixels: 64, rotation: 0, fit: true },
  });
}
function frame() {
  const view = canvas.value?.getView();
  if (view) c.updateDisplay({ camera: { ...c.display.camera, x: view.x, y: view.y, fit: false } });
}
function gesture({ phase, point }) {
  const m = c.selected;
  if (!m || c.conflict || playerPreview.value) return;
  if (phase === 'hover') return;
  if (phase === 'cancel') {
    if (drag?.before) m.state = drag.before;
    drag = null;
    c.editing = false;
    return;
  }
  if (phase === 'start') {
    if (!inside(m.document, point.x, point.y)) return;
    if (pendingToken.value) {
      const token = {
        ...pendingToken.value,
        id: uid(),
        ...snap(m.document, point),
        size: 1,
        hidden: false,
        physical: false,
      };
      c.change((s) => s.tokens.push(token));
      selectedToken.value = token.id;
      pendingToken.value = null;
      return;
    }
    const token = [...m.state.tokens]
      .reverse()
      .find((t) => Math.abs(t.x - point.x) <= t.size / 2 && Math.abs(t.y - point.y) <= t.size / 2);
    selectedToken.value = token?.id || '';
    drag = { start: point, token: token?.id, before: clone(m.state) };
    c.editing = true;
  } else if (phase === 'move' && drag?.token) {
    const token = m.state.tokens.find((t) => t.id === drag.token);
    Object.assign(token, snap(m.document, point, token.size));
  } else if (phase === 'end' && drag) {
    if (drag.token) c.persist();
    else if (Math.hypot(point.x - drag.start.x, point.y - drag.start.y) < 0.3) {
      const o = [...m.document.objects]
        .reverse()
        .find(
          (o) => interactive(o.kind) && Math.hypot(o.x - point.x, o.y - point.y) < o.scale * 0.7,
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
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.session-map-workspace > .map-toolbar > select {
  flex: 1;
  min-width: 140px;
  max-width: 320px;
}
.session-map-workspace > .map-toolbar > strong {
  font-family: var(--font-display);
  font-size: 24px;
  color: var(--text-1);
  margin-right: 12px;
}
.session-map-editor {
  flex: 1;
  min-height: 0;
  border: 1px solid var(--border-strong);
  border-radius: 14px;
  overflow: hidden;
}
.session-map-editor .map-editor-main {
  padding: 10px;
}
@media (max-width: 760px) {
  .session-map-workspace > .map-toolbar > strong {
    display: none;
  }
}
</style>
