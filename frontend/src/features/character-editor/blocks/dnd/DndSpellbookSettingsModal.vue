<template>
  <AppModalFrame :title="modalTitle" @close="$emit('close')">
    <EditorSection v-if="showTabConfig" title="Вкладка">
      <div class="ssm-fields">
        <FormField label="Название" vertical>
          <FormTextInput :value="tabName" placeholder="Например, Волшебник" @update:value="$emit('set-tab-name', $event)" />
        </FormField>
        <FormField label="Класс" vertical>
          <ValueSelect
            :model-value="classItemId"
            :options="availableClassOptions"
            placeholder="Без класса"
            @update:model-value="$emit('set-class-item', $event)"
          />
        </FormField>
        <FormField label="Режим" vertical>
          <ValueSelect :model-value="mode" :options="MODE_OPTIONS" @update:model-value="$emit('set-mode', $event)" />
        </FormField>
      </div>
    </EditorSection>

    <EditorSection v-if="showSlotConfig" title="Расчёт ячеек">
      <ToggleSwitch
        :model-value="automaticSlots"
        label="Автоматически по уровням классов"
        @update:model-value="$emit('set-automatic-slots', $event)"
      />
      <p class="ssm-hint">Отключите для домашних правил и ручного пула ячеек.</p>
    </EditorSection>

    <EditorSection v-if="showCastingConfig" title="Базовая характеристика">
      <ValueSelect
        :model-value="statPath"
        :options="[{ value: '', label: '—' }, ...statOptions]"
        placeholder="—"
        @update:model-value="$emit('set-stat-path', $event)"
      />
    </EditorSection>

    <button v-if="showTabConfig && allowDelete" type="button" class="ssm-delete" @click="$emit('delete-tab')">
      Удалить вкладку
    </button>

    <EditorSection v-if="showCastingConfig" title="Бонусы">
      <div class="ssm-bonus">
        <span class="ssm-bonus-label">Спасбросок</span>
        <FormNumberInput :value="saveBonus" @change="$emit('set-save-bonus', $event)" />
      </div>
      <div class="ssm-bonus">
        <span class="ssm-bonus-label">Атака заклинаний</span>
        <FormNumberInput :value="attackBonus" @change="$emit('set-attack-bonus', $event)" />
      </div>
    </EditorSection>

    <EditorSection v-if="showSlotConfig" title="Ячейки заклинаний">
      <MultiToggle
        block
        :model-value="editingRest"
        :options="REST_OPTIONS"
        @update:model-value="editingRest = $event"
      />
      <div class="ssm-grid">
        <div v-for="sl in slots" :key="sl.level" class="ssm-cell">
          <span class="ssm-lvl">{{ sl.level }} круг</span>
          <FormNumberInput :value="sl.total" :min="0" :max="9" @change="$emit('change', editingRest, sl.level, $event)" />
        </div>
      </div>
    </EditorSection>
  </AppModalFrame>
</template>

<script setup>
import { computed, ref } from 'vue'
import { EditorSection } from '@sylvieshare/share-ui'
import { AppModalFrame } from '@sylvieshare/share-ui'
import { MultiToggle } from '@sylvieshare/share-ui'
import { ToggleSwitch } from '@sylvieshare/share-ui'
import { ValueSelect } from '@sylvieshare/share-ui'
import { FormNumberInput } from '@sylvieshare/share-ui'
import { FormField, FormTextInput } from '@sylvieshare/share-ui'

const REST_OPTIONS = [
  { value: 'long_rest', label: 'Долгий отдых' },
  { value: 'short_rest', label: 'Короткий отдых' },
]
const MODE_OPTIONS = [
  { value: 'known', label: 'Известные заклинания' },
  { value: 'prepared', label: 'Подготавливаемые заклинания' },
  { value: 'spellbook', label: 'Книга заклинаний' },
]

const props = defineProps({
  slotPools:   { type: Object, required: true },
  statPath:    { default: '' },
  statOptions: { type: Array, default: () => [] },
  saveBonus:   { type: Number, default: 0 },
  attackBonus: { type: Number, default: 0 },
  automaticSlots: { type: Boolean, default: true },
  showCastingConfig: { type: Boolean, default: true },
  castingLabel: { type: String, default: '' },
  showSlotConfig: { type: Boolean, default: true },
  showTabConfig: { type: Boolean, default: false },
  tabName: { type: String, default: '' },
  classItemId: { default: null },
  classOptions: { type: Array, default: () => [] },
  usedClassItemIds: { type: Array, default: () => [] },
  mode: { type: String, default: 'known' },
  allowDelete: { type: Boolean, default: false },
})
defineEmits(['close', 'change', 'set-stat-path', 'set-save-bonus', 'set-attack-bonus', 'set-automatic-slots', 'set-tab-name', 'set-class-item', 'set-mode', 'delete-tab'])

const editingRest = ref('long_rest')
const slots = computed(() => props.slotPools?.[editingRest.value] || [])
const modalTitle = computed(() => props.showCastingConfig && props.castingLabel
  ? `Магия · ${props.castingLabel}`
  : 'Магия')
const availableClassOptions = computed(() => {
  const used = new Set(props.usedClassItemIds.map(String))
  return [{ value: null, label: 'Без класса' }, ...props.classOptions.filter((option) =>
    String(option.value) === String(props.classItemId) || !used.has(String(option.value)))]
})
</script>

<style scoped>
.ssm-bonus {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.ssm-bonus-label {
  color: var(--text-2);
  font-size: 13px;
}

.ssm-hint { margin: 6px 0 0; color: var(--text-muted); font-size: 11px; }
.ssm-fields { display: grid; gap: 12px; }
.ssm-delete { width: 100%; border: 1px solid color-mix(in srgb, var(--danger) 45%, var(--border)); border-radius: 9px; background: transparent; color: var(--danger); cursor: pointer; padding: 9px 12px; font: inherit; font-size: 12px; font-weight: 700; }

.ssm-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 14px;
  margin-top: 12px;
}

.ssm-cell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.ssm-lvl {
  color: var(--info);
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}
</style>
