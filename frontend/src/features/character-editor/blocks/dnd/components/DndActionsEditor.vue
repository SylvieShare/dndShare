<template>
  <EditorPanel compact>
    <EditorSection title="Свои действия">
      <div v-if="manualActions.length" class="dae-list">
        <div v-for="action in manualActions" :key="action.uid" class="dae-card">
          <div class="dae-head">
            <input
              class="dae-input"
              :value="action.title"
              placeholder="Название действия"
              @input="$emit('change', action.uid, { title: $event.target.value })"
            />
            <FormSelect
              class="dae-select"
              :value="action.action_type || 'action'"
              @update:value="$emit('change', action.uid, { action_type: $event })"
            >
              <option v-for="type in FEATURE_ACTION_TYPES" :key="type.value" :value="type.value">{{ type.label }}</option>
            </FormSelect>
            <RemoveButton label="Удалить действие" @click="$emit('remove', action.uid)" />
          </div>
          <textarea
            class="dae-textarea"
            :value="action.description"
            placeholder="Что происходит"
            @input="$emit('change', action.uid, { description: $event.target.value })"
          ></textarea>
          <textarea
            class="dae-textarea dae-textarea--requirements"
            :value="(action.requirements || []).join('\n')"
            placeholder="Условия — по одному на строку"
            @input="$emit('change', action.uid, { requirements: lines($event.target.value) })"
          ></textarea>
        </div>
      </div>
      <AddButton block @click="$emit('add')">Добавить действие</AddButton>
    </EditorSection>

    <EditorSection v-if="readonlyActions.length" title="Из способностей">
      <div class="dae-readonly-list">
        <div v-for="action in readonlyActions" :key="action.key" class="dae-readonly-row">
          <span>
            <strong>{{ action.title }}</strong>
            <small>{{ typeLabel(action.action_type) }} · Источник: {{ action.source_label }}</small>
            <em v-for="requirement in action.requirements" :key="requirement">{{ requirement }}</em>
          </span>
          <b>Только чтение</b>
        </div>
      </div>
    </EditorSection>
  </EditorPanel>
</template>

<script setup>
import { AddButton, EditorPanel, EditorSection, FormSelect, RemoveButton } from '@sylvieshare/share-ui'
import { FEATURE_ACTION_TYPES } from '@/features/character-editor/lib/characterFeatureActions'

defineProps({
  manualActions: { type: Array, default: () => [] },
  readonlyActions: { type: Array, default: () => [] },
})
defineEmits(['add', 'change', 'remove'])

function lines(value) {
  return String(value || '').split('\n').map(line => line.trim()).filter(Boolean)
}

function typeLabel(value) {
  return FEATURE_ACTION_TYPES.find(type => type.value === value)?.label || 'Особое действие'
}
</script>

<style scoped>
.dae-list, .dae-readonly-list { display: flex; flex-direction: column; gap: 8px; }
.dae-card { display: flex; flex-direction: column; gap: 7px; padding: 9px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-raised); }
.dae-head { display: grid; grid-template-columns: minmax(0, 1fr) minmax(145px, .75fr) auto; gap: 7px; align-items: center; }
.dae-input, .dae-textarea { width: 100%; box-sizing: border-box; border: 1px solid var(--border-strong); border-radius: 7px; background: var(--surface); color: var(--text-1); font: inherit; font-size: 12px; }
.dae-input { min-height: 36px; padding: 7px 9px; }
.dae-select { min-height: 36px; }
.dae-textarea { min-height: 58px; padding: 8px 9px; resize: vertical; line-height: 1.4; }
.dae-textarea--requirements { min-height: 48px; color: var(--text-2); font-size: 11px; }
.dae-readonly-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; padding: 10px 11px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-raised); }
.dae-readonly-row > span { display: flex; min-width: 0; flex-direction: column; gap: 3px; }
.dae-readonly-row strong { color: var(--text-1); font-size: 12px; }
.dae-readonly-row small { color: var(--text-muted); font-size: 10px; }
.dae-readonly-row em { color: var(--text-2); font-size: 9px; font-style: normal; }
.dae-readonly-row > b { flex: 0 0 auto; color: var(--text-muted); font-size: 8px; font-weight: 650; text-transform: uppercase; }
@media (max-width: 560px) { .dae-head { grid-template-columns: minmax(0, 1fr) auto; }.dae-select { grid-column: 1; } }
</style>
