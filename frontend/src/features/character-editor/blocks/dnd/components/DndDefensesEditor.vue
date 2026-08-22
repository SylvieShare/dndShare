<template>
  <EditorPanel compact>
    <EditorSection title="Ручные защиты">
      <div v-if="defenses.length" class="dde-list">
        <div v-for="(row, index) in defenses" :key="index" class="dde-row">
          <SuggestPicker
            class="dde-damage"
            :model-value="row.damage_type"
            :suggest-type-id="damageTypeSuggestId"
            value-key="id"
            placeholder="Тип урона"
            @update:model-value="$emit('change', index, { damage_type: $event })"
          />
          <FormSelect
            class="dde-kind"
            :value="row.kind || 'resistance'"
            @update:value="$emit('change', index, { kind: $event })"
          >
            <option v-for="kind in DEFENSE_KINDS" :key="kind.value" :value="kind.value">{{ kind.label }}</option>
          </FormSelect>
          <RemoveButton label="Удалить защиту" @click="$emit('remove', index)" />
        </div>
      </div>
      <AddButton block @click="$emit('add')">Защита</AddButton>
    </EditorSection>

    <EditorSection v-if="readonlyDefenses.length" title="Из листа">
      <div class="dde-readonly-list">
        <div v-for="row in readonlyDefenses" :key="row.key" class="dde-readonly-row">
          <span>
            <strong>{{ damageTypeLabel(row.damage_type) }}</strong>
            <small>{{ kindLabel(row.kind) }} · Источник: {{ row.source_label || 'способности' }}</small>
          </span>
          <span class="dde-lock">Только чтение</span>
        </div>
      </div>
    </EditorSection>
  </EditorPanel>
</template>

<script setup>
import { AddButton, EditorPanel, EditorSection, FormSelect, RemoveButton } from '@sylvieshare/share-ui'
import SuggestPicker from '@/shared/ui/SuggestPicker.vue'
import { DEFENSE_KINDS } from '@/features/character-editor/lib/characterDefenses'

const props = defineProps({
  defenses: { type: Array, default: () => [] },
  readonlyDefenses: { type: Array, default: () => [] },
  damageTypes: { type: Array, default: () => [] },
  damageTypeSuggestId: { type: Number, default: 12 },
})

defineEmits(['change', 'remove', 'add'])

function kindLabel(kind) {
  return DEFENSE_KINDS.find((entry) => entry.value === kind)?.label || 'Сопротивление'
}

function damageTypeLabel(id) {
  return props.damageTypes.find((entry) => String(entry.id) === String(id))?.value || `Тип #${id}`
}
</script>

<style scoped>
.dde-list, .dde-readonly-list { display: flex; flex-direction: column; gap: 8px; }
.dde-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(135px, .8fr) auto; align-items: center; gap: 8px; }
.dde-damage { position: relative; min-width: 0; }
.dde-damage :deep(.sp-trigger), .dde-damage :deep(.sp-input), .dde-kind { width: 100%; min-height: 36px; box-sizing: border-box; }
.dde-readonly-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 11px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-raised); }
.dde-readonly-row > span:first-child { display: flex; min-width: 0; flex-direction: column; gap: 3px; }
.dde-readonly-row strong { color: var(--text-1); font-size: 12px; }
.dde-readonly-row small { color: var(--text-muted); font-size: 10px; line-height: 1.35; }
.dde-lock { flex: 0 0 auto; color: var(--text-muted); font-size: 9px; text-transform: uppercase; }
@media (max-width: 520px) { .dde-row { grid-template-columns: minmax(0, 1fr) auto; }.dde-kind { grid-column: 1; } }
</style>
