<template>
  <EditorPanel compact>
    <EditorSection title="Своё действие">
      <div class="dae-form">
        <label>
          <span>Название</span>
          <input
            class="dae-input"
            :value="action.title"
            placeholder="Название действия"
            @input="$emit('change', { title: $event.target.value })"
          />
        </label>
        <label>
          <span>Тип</span>
          <FormSelect
            class="dae-select"
            :value="action.action_type || 'action'"
            @update:value="$emit('change', { action_type: $event })"
          >
            <option v-for="type in FEATURE_ACTION_TYPES" :key="type.value" :value="type.value">{{ type.label }}</option>
          </FormSelect>
        </label>
        <label>
          <span>Описание</span>
          <textarea
            class="dae-textarea"
            :value="action.description"
            placeholder="Что происходит"
            @input="$emit('change', { description: $event.target.value })"
          ></textarea>
        </label>
        <label>
          <span>Условия</span>
          <textarea
            class="dae-textarea dae-textarea--requirements"
            :value="(action.requirements || []).join('\n')"
            placeholder="По одному на строку"
            @input="$emit('change', { requirements: lines($event.target.value) })"
          ></textarea>
        </label>
      </div>
    </EditorSection>
  </EditorPanel>
</template>

<script setup>
import { EditorPanel, EditorSection, FormSelect } from '@sylvieshare/share-ui'
import { FEATURE_ACTION_TYPES } from '@/features/character-editor/lib/characterFeatureActions'

defineProps({ action: { type: Object, required: true } })
defineEmits(['change'])

function lines(value) {
  return String(value || '').split('\n').map(line => line.trim()).filter(Boolean)
}
</script>

<style scoped>
.dae-form { display: flex; flex-direction: column; gap: 10px; }
.dae-form label { display: flex; flex-direction: column; gap: 5px; color: var(--text-muted); font-size: 10px; font-weight: 700; }
.dae-input, .dae-textarea { width: 100%; box-sizing: border-box; border: 1px solid var(--border-strong); border-radius: 7px; background: var(--surface); color: var(--text-1); font: inherit; font-size: 12px; }
.dae-input { min-height: 36px; padding: 7px 9px; }
.dae-select { min-height: 36px; }
.dae-textarea { min-height: 68px; padding: 8px 9px; resize: vertical; line-height: 1.4; }
.dae-textarea--requirements { min-height: 54px; color: var(--text-2); font-size: 11px; }
</style>
