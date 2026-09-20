<template>
  <aside class="map-inspector">
    <MultiToggle
      v-model="tab"
      :options="[
        { value: 'zones', label: 'Туман' },
        { value: 'tokens', label: 'Жетоны' },
        { value: 'screen', label: 'Стол' },
      ]"
      block
      aria-label="Управление картой"
    />
    <template v-if="tab === 'zones'">
      <ToggleSwitch
        :model-value="map.state.fog"
        label="Туман войны"
        :disabled="controller.conflict"
        @update:model-value="
          controller.change((s) => {
            s.fog = $event;
          })
        "
      />
      <p class="map-hint">
        Штриховка видна только мастеру. На столе скрытая область закрыта полностью. В пересечении
        зон действует наиболее открытая.
      </p>
      <div class="map-tool-grid">
        <ActionButton variant="secondary" @click="all('visible')"
          ><Eye :size="15" />Открыть всё</ActionButton
        ><ActionButton variant="secondary" @click="all('hidden')"
          ><EyeOff :size="15" />Скрыть всё</ActionButton
        >
      </div>
      <div v-for="zone in map.document.zones" :key="zone.id" class="map-zone-row">
        <button type="button" class="map-zone-name" @click="emit('zone', zone.id)">
          {{ zone.name }}
        </button>
        <FormSelect
          :value="map.state.zones[zone.id] || 'hidden'"
          :aria-label="`Видимость зоны ${zone.name}`"
          @change="
            controller.change((s) => {
              s.zones[zone.id] = $event;
            })
          "
          ><option v-for="v in VISIBILITY" :key="v.value" :value="v.value">
            {{ v.label }}
          </option></FormSelect
        >
      </div>
      <p v-if="!map.document.zones.length" class="map-hint">
        Зон пока нет. Их можно подготовить в редакторе исходной карты перед добавлением в сессию.
      </p>
    </template>
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
    <MapDisplaySettings
      v-else-if="controller.display"
      :display="controller.display"
      :path="screenPath"
      :busy="controller.displaySaving"
      :selected-on-air="controller.display.mapId === map.id"
      @update="controller.updateDisplay"
      @frame="emit('frame')"
    />
  </aside>
</template>
<script setup>
import { computed, ref, watch } from 'vue';
import {
  ActionButton,
  FormField,
  FormSelect,
  FormTextInput,
  MultiToggle,
  ToggleSwitch,
} from '@sylvieshare/share-ui';
import { Eye, EyeOff, Plus, Trash2, UserRound } from '@lucide/vue';
import { VISIBILITY } from '../lib/mapModel';
import MapDisplaySettings from './MapDisplaySettings.vue';
const props = defineProps({
    controller: { type: Object, required: true },
    candidates: Array,
    selectedToken: String,
    pending: Object,
    screenPath: String,
  }),
  emit = defineEmits(['place', 'token', 'zone', 'frame']);
const tab = ref('zones'),
  search = ref(''),
  map = computed(() => props.controller.selected),
  token = computed(() => map.value.state.tokens.find((t) => t.id === props.selectedToken));
watch(
  () => props.selectedToken,
  (id) => {
    if (id) tab.value = 'tokens';
  },
);
const available = computed(() =>
  props.candidates.filter(
    (c) =>
      !map.value.state.tokens.some((t) => t.kind === c.kind && t.ref === c.ref) &&
      c.name.toLocaleLowerCase().includes(search.value.toLocaleLowerCase()),
  ),
);
function all(value) {
  props.controller.change((s) => {
    s.defaultVisibility = value;
    s.zones = Object.fromEntries(map.value.document.zones.map((z) => [z.id, value]));
  });
}
</script>
<style scoped>
.map-zone-row {
  display: grid;
  gap: 7px;
  padding-block: 7px;
  border-bottom: 1px solid var(--border-strong);
}
.map-zone-name {
  padding: 0;
  background: none;
  border: none;
  font: inherit;
  color: var(--text-1);
  text-align: left;
  cursor: pointer;
}
.map-token-avatar {
  width: 24px;
  height: 24px;
  object-fit: contain;
}
</style>
