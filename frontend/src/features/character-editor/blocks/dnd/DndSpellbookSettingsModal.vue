<template>
  <AppModalFrame :title="modalTitle" @close="$emit('close')">
    <EditorSection v-if="showCastingConfig" title="Подготовка">
      <ToggleSwitch
        :model-value="preparation"
        label="Подготовка заклинаний"
        @update:model-value="$emit('set-preparation', $event)"
      />
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

const REST_OPTIONS = [
  { value: 'long_rest', label: 'Долгий отдых' },
  { value: 'short_rest', label: 'Короткий отдых' },
]

const props = defineProps({
  slotPools:   { type: Object, required: true },
  statPath:    { default: '' },
  statOptions: { type: Array, default: () => [] },
  saveBonus:   { type: Number, default: 0 },
  attackBonus: { type: Number, default: 0 },
  preparation: { type: Boolean, default: false },
  automaticSlots: { type: Boolean, default: true },
  showCastingConfig: { type: Boolean, default: true },
  castingLabel: { type: String, default: '' },
  showSlotConfig: { type: Boolean, default: true },
})
defineEmits(['close', 'change', 'set-stat-path', 'set-save-bonus', 'set-attack-bonus', 'set-preparation', 'set-automatic-slots'])

const editingRest = ref('long_rest')
const slots = computed(() => props.slotPools?.[editingRest.value] || [])
const modalTitle = computed(() => props.showCastingConfig && props.castingLabel
  ? `Магия · ${props.castingLabel}`
  : 'Магия')
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
