<template>
  <MapSidebar ref="sidebar" v-model:tab="tab" class="session-map-inspector" :tabs="tabs" :collapse-at="1200"
    aria-label="Управление картой" @resize="sidebarWidth = $event">
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
  </MapSidebar>
</template>
<script setup>
import { computed, ref, watch } from 'vue';
import {
  ActionButton,
  FormField,
  FormSelect,
  FormTextInput,
  ToggleSwitch,
  useIsMobile,
} from '@sylvieshare/share-ui';
import { Group, Lightbulb, MonitorUp, EyeOff, Plus, Trash2, UserRound } from '@lucide/vue';
import MapSidebar from './MapSidebar.vue';
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
    if (id) sidebar.value?.openTab('tokens');
  },
);
const available = computed(() =>
  props.candidates.filter(
    (c) =>
      !map.value.state.tokens.some((t) => t.kind === c.kind && t.ref === c.ref) &&
      c.name.toLocaleLowerCase().includes(search.value.toLocaleLowerCase()),
  ),
);
const sidebar = ref(null);
const sidebarWidth = ref(334);
const mobile = useIsMobile(760);
const tabs = [
  { key: 'areas', label: 'Области', icon: Group },
  { key: 'tokens', label: 'Жетоны', icon: UserRound },
  { key: 'lights', label: 'Освещение', icon: Lightbulb },
  { key: 'screen', label: 'Трансляция', icon: MonitorUp },
];
watch([sidebarWidth, mobile], ([width, isMobile]) => emit('resize', isMobile ? 48 : width), { immediate: true });
</script>
<style scoped>
.session-map-inspector { position: absolute; z-index: 8; top: 0; left: 0; bottom: 0; }
.map-token-avatar { width: 24px; height: 24px; object-fit: contain; }
</style>
