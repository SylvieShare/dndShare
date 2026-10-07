<template>
  <aside class="session-map-inspector" :class="{ 'session-map-inspector--collapsed': collapsed }" aria-label="Управление картой">
    <nav class="session-map-tabs" aria-label="Вкладки карты">
      <ActionButton v-for="item in tabs" :key="item.key" icon-only
        :variant="tab === item.key && !collapsed ? 'primary' : 'quiet'"
        :aria-label="item.label" :title="item.label" :aria-pressed="tab === item.key && !collapsed"
        @click="openTab(item.key)">
        <template #icon><component :is="item.icon" :size="22" /></template>
      </ActionButton>
    </nav>
    <div v-show="!collapsed" class="session-map-panel">
      <header class="session-map-panel-heading">
        <strong>{{ tabs.find(item => item.key === tab)?.label }}</strong>
        <ActionButton variant="quiet" icon-only aria-label="Свернуть управление картой" title="Свернуть управление картой"
          @click="collapsed = true"><template #icon><PanelLeftClose :size="20" /></template></ActionButton>
      </header>
      <div class="session-map-panel-content">
    <SessionMapAreasPanel v-if="tab === 'areas'" :controller="controller" @zone="emit('zone', $event)" />
    <template v-else-if="tab === 'tokens'">
      <template v-if="token">
        <strong>{{ token.name }}</strong>
        <FormTextInput
          v-if="token.kind === 'marker'"
          :value="token.name"
          aria-label="Название метки"
          :maxlength="100"
          @change="
            controller.change(() => {
              token.name = $event;
            })
          "
        />
        <FormField label="Размер, клеток"
          ><FormSelect
            :value="token.size"
            @change="
              controller.change(() => {
                token.size = Number($event);
              })
            "
            ><option v-for="n in [0.5, 1, 2, 3, 4, 6, 8]" :key="n" :value="n">
              {{ n }} × {{ n }}
            </option></FormSelect
          ></FormField
        >
        <ToggleSwitch
          :model-value="token.physical"
          label="Физическая миниатюра"
          @update:model-value="
            controller.change(() => {
              token.physical = $event;
            })
          "
        />
        <ToggleSwitch
          :model-value="token.hidden"
          label="Скрыть от игроков"
          @update:model-value="
            controller.change(() => {
              token.hidden = $event;
            })
          "
        />
        <p class="map-hint">
          Физический жетон виден только мастеру. Перемещение миниатюры на столе не меняет его
          позицию автоматически.
        </p>
        <ActionButton
          variant="secondary"
          @click="
            controller.change((s) => {
              s.tokens = s.tokens.filter((t) => t.id !== token.id);
            });
            emit('token', '');
          "
          ><Trash2 :size="15" />Убрать с карты</ActionButton
        >
        <hr />
      </template>
      <strong>На карте · {{ map.state.tokens.length }}</strong>
      <ActionButton
        v-for="t in map.state.tokens"
        :key="t.id"
        :variant="token?.id === t.id ? 'primary' : 'quiet'"
        @click="emit('token', t.id)"
        >{{ t.name }}<span v-if="t.physical"> · миниатюра</span><EyeOff v-if="t.hidden" :size="13"
      /></ActionButton>
      <hr />
      <strong>Добавить из сессии</strong>
      <p class="map-hint">
        Выберите участника, затем нажмите на карту. Существа берутся из боя и резерва.
      </p>
      <FormTextInput
        v-model:value="search"
        placeholder="Найти участника…"
        aria-label="Найти участника"
      />
      <ActionButton
        v-for="c in available"
        :key="c.kind + c.ref"
        :variant="pending?.ref === c.ref && pending?.kind === c.kind ? 'primary' : 'secondary'"
        @click="emit('place', c)"
        ><img v-if="c.imageUrl" :src="c.imageUrl" class="map-token-avatar" alt="" /><UserRound
          v-else
          :size="20"
        />{{ c.name }}</ActionButton
      >
      <ActionButton
        variant="quiet"
        @click="emit('place', { kind: 'marker', ref: '', name: 'Метка', color: '#d4ae69' })"
        ><Plus :size="15" />Свободная метка</ActionButton
      >
    </template>
    <SessionMapLightingPanel v-else-if="tab === 'lights'" :controller="controller" />
    <MapDisplaySettings
      v-else-if="controller.display"
      :display="controller.display"
      :path="screenPath"
      :busy="controller.displaySaving"
      :selected-on-air="controller.display.mapId === map.id"
      @update="controller.updateDisplay"
      @frame="emit('frame')"
    />
      </div>
    </div>
  </aside>
</template>
<script setup>
import { computed, ref, watch } from 'vue';
import {
  ActionButton,
  FormField,
  FormSelect,
  FormTextInput,
  ToggleSwitch,
} from '@sylvieshare/share-ui';
import { Group, Lightbulb, MonitorUp, PanelLeftClose, EyeOff, Plus, Trash2, UserRound } from '@lucide/vue';
import SessionMapAreasPanel from './SessionMapAreasPanel.vue';
import SessionMapLightingPanel from './SessionMapLightingPanel.vue';
import MapDisplaySettings from './MapDisplaySettings.vue';
const props = defineProps({
    controller: { type: Object, required: true },
    candidates: Array,
    selectedToken: String,
    pending: Object,
    screenPath: String,
  }),
  emit = defineEmits(['place', 'token', 'zone', 'frame', 'resize']);
const tab = ref('areas'),
  search = ref(''),
  map = computed(() => props.controller.selected),
  token = computed(() => map.value.state.tokens.find((t) => t.id === props.selectedToken));
watch(
  () => props.selectedToken,
  (id) => {
    if (id) openTab('tokens');
  },
);
const available = computed(() =>
  props.candidates.filter(
    (c) =>
      !map.value.state.tokens.some((t) => t.kind === c.kind && t.ref === c.ref) &&
      c.name.toLocaleLowerCase().includes(search.value.toLocaleLowerCase()),
  ),
);
const collapsed = ref(window.matchMedia('(max-width: 1200px)').matches);
const tabs = [
  { key: 'areas', label: 'Области', icon: Group },
  { key: 'tokens', label: 'Жетоны', icon: UserRound },
  { key: 'lights', label: 'Освещение', icon: Lightbulb },
  { key: 'screen', label: 'Трансляция', icon: MonitorUp },
];
function openTab(key) {
  tab.value = key;
  collapsed.value = false;
}
watch(collapsed, value => emit('resize', value || window.matchMedia('(max-width: 760px)').matches ? 48 : 334), { immediate: true });
</script>
<style scoped>
.session-map-inspector {
  position: absolute;
  z-index: 8;
  top: 14px;
  left: 14px;
  bottom: 14px;
  display: flex;
  width: 334px;
  min-height: 0;
  border: 1px solid var(--border-strong);
  border-radius: 12px;
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  box-sizing: border-box;
  overflow: hidden;
}
.session-map-inspector--collapsed { width: 48px; }
.session-map-tabs { display: flex; flex-direction: column; gap: 6px; width: 48px; flex: none; padding-top: 6px; border-right: 1px solid var(--border-strong); }
.session-map-panel { display: flex; flex: 1; flex-direction: column; min-width: 0; min-height: 0; }
.session-map-panel-heading { display: flex; align-items: center; justify-content: space-between; padding: 6px 6px 6px 12px; }
.session-map-panel-content { display: flex; flex-direction: column; gap: 14px; overflow: auto; min-height: 0; padding: 8px 12px 18px; }
.session-map-panel-content hr { width: 100%; border: 0; border-top: 1px solid var(--border-strong); }
.map-token-avatar { width: 24px; height: 24px; object-fit: contain; }
@media (max-width: 760px) {
  .session-map-inspector:not(.session-map-inspector--collapsed) { width: min(334px, calc(100vw - 42px)); }
}
</style>
