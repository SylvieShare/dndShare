<template>
  <AppModal tile @close="$emit('close')">
    <div class="ssm-title">Магия</div>

    <EditorSection title="Подготовка">
      <ToggleSwitch
        :model-value="preparation"
        label="Подготовка заклинаний"
        @update:model-value="$emit('set-preparation', $event)"
      />
    </EditorSection>

    <EditorSection title="Базовая характеристика">
      <ValueSelect
        :model-value="statPath"
        :options="[{ value: '', label: '—' }, ...statOptions]"
        placeholder="—"
        @update:model-value="$emit('set-stat-path', $event)"
      />
    </EditorSection>

    <EditorSection title="Бонусы">
      <div class="ssm-bonus">
        <span class="ssm-bonus-label">Спасбросок</span>
        <FormNumberInput :value="saveBonus" @change="$emit('set-save-bonus', $event)" />
      </div>
      <div class="ssm-bonus">
        <span class="ssm-bonus-label">Атака заклинаний</span>
        <FormNumberInput :value="attackBonus" @change="$emit('set-attack-bonus', $event)" />
      </div>
    </EditorSection>

    <EditorSection title="Восстановление ячеек">
      <MultiToggle
        block
        :model-value="slotsRest"
        :options="REST_OPTIONS"
        @update:model-value="$emit('set-slots-rest', $event)"
      />
    </EditorSection>

    <EditorSection title="Ячейки заклинаний">
      <div class="ssm-grid">
        <div v-for="sl in slots" :key="sl.level" class="ssm-cell">
          <span class="ssm-lvl">{{ sl.level }} круг</span>
          <FormNumberInput :value="sl.total" :min="0" :max="9" @change="$emit('change', sl.level, $event)" />
        </div>
      </div>
    </EditorSection>
  </AppModal>
</template>

<script setup>
import EditorSection from '@/features/character-editor/components/EditorSection'
import AppModal from '@/shared/ui/AppModal'
import MultiToggle from '@/shared/ui/MultiToggle'
import ToggleSwitch from '@/shared/ui/ToggleSwitch'
import ValueSelect from '@/shared/ui/ValueSelect'
import FormNumberInput from '@/shared/ui/form/FormNumberInput'

const REST_OPTIONS = [
  { value: 'long_rest', label: 'Длинный отдых' },
  { value: 'short_rest', label: 'Короткий отдых' },
]

defineProps({
  slots:       { type: Array, required: true },
  statPath:    { default: '' },
  statOptions: { type: Array, default: () => [] },
  saveBonus:   { type: Number, default: 0 },
  attackBonus: { type: Number, default: 0 },
  slotsRest:   { type: String, default: 'long_rest' },
  preparation: { type: Boolean, default: false },
})
defineEmits(['close', 'change', 'set-stat-path', 'set-save-bonus', 'set-attack-bonus', 'set-slots-rest', 'set-preparation'])
</script>

<style scoped>
.ssm-title {
  color: var(--text-1);
  font-size: 16px;
  font-weight: 700;
  padding-right: 24px;
  margin-bottom: 14px;
}

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

.ssm-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 14px;
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
