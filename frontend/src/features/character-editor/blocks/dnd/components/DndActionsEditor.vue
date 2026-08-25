<template>
  <EditorPanel compact>
    <EditorSection title="Свои действия">
      <div v-if="actions.length" class="dae-list">
        <article
          v-for="action in displayActions"
          :key="action.uid"
          class="dae-card"
          :class="{ 'dae-card--selected': action.uid === selectedUid }"
        >
          <div class="dae-top">
            <FormSelect
              class="dae-select"
              :value="action.action_type || 'action'"
              aria-label="Тип действия"
              @update:value="change(action.uid, { action_type: $event })"
            >
              <option v-for="type in FEATURE_ACTION_TYPES" :key="type.value" :value="type.value">{{ type.label }}</option>
            </FormSelect>
            <RemoveButton label="Удалить действие" @click="$emit('remove', action)" />
          </div>

          <label>
            <span>Название</span>
            <input
              class="dae-input"
              :value="action.title"
              placeholder="Название действия"
              @input="change(action.uid, { title: $event.target.value })"
            />
          </label>
          <label>
            <span>Описание</span>
            <textarea
              class="dae-textarea"
              :value="action.description"
              placeholder="Что происходит"
              @input="change(action.uid, { description: $event.target.value })"
            ></textarea>
          </label>
          <label>
            <span>Условия</span>
            <textarea
              class="dae-textarea dae-textarea--requirements"
              :value="(action.requirements || []).join('\n')"
              placeholder="По одному на строку"
              @input="change(action.uid, { requirements: draftLines($event.target.value) })"
              @blur="change(action.uid, { requirements: lines($event.target.value) })"
            ></textarea>
          </label>
        </article>
      </div>
      <div v-else class="dae-empty">Своих действий нет</div>

      <AddButton block @click="$emit('add')">Добавить действие</AddButton>
    </EditorSection>

    <EditorSection v-if="readonlyActions.length" title="Из листа">
      <div class="dae-readonly-list">
        <div v-for="action in readonlyActions" :key="action.key" class="dae-readonly-row">
          <span class="dae-readonly-copy">
            <strong>{{ action.title }}</strong>
            <small>{{ typeLabel(action.action_type) }} · {{ action.source_label }}</small>
          </span>
          <span class="dae-lock">Только чтение</span>
        </div>
      </div>
    </EditorSection>
  </EditorPanel>
</template>

<script setup>
import { computed } from 'vue'
import { AddButton, EditorPanel, EditorSection, FormSelect, RemoveButton } from '@sylvieshare/share-ui'
import { FEATURE_ACTION_TYPES } from '@/features/character-editor/lib/characterFeatureActions'

const props = defineProps({
  actions: { type: Array, default: () => [] },
  readonlyActions: { type: Array, default: () => [] },
  selectedUid: { type: [String, Number], default: null },
})
const emit = defineEmits(['add', 'change', 'remove'])
const displayActions = computed(() => {
  if (props.selectedUid == null) return props.actions
  const selected = props.actions.find(action => action.uid === props.selectedUid)
  return selected ? [selected, ...props.actions.filter(action => action !== selected)] : props.actions
})

function change(uid, patch) {
  emit('change', uid, patch)
}

function typeLabel(value) {
  return FEATURE_ACTION_TYPES.find(type => type.value === value)?.label || 'Особое действие'
}

function lines(value) {
  return String(value || '').split('\n').map(line => line.trim()).filter(Boolean)
}

function draftLines(value) {
  return String(value ?? '').split('\n')
}
</script>

<style scoped>
.dae-list { display: flex; flex-direction: column; gap: 12px; }
.dae-card { display: flex; flex-direction: column; gap: 10px; padding: 12px; border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--surface); transition: border-color .15s, box-shadow .15s; }
.dae-card--selected { border-color: color-mix(in srgb, var(--accent) 58%, var(--border)); box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 10%, transparent); }
.dae-top { display: flex; align-items: center; gap: 8px; }
.dae-select { flex: 1; min-width: 0; min-height: 34px; }
.dae-card label { display: flex; flex-direction: column; gap: 5px; color: var(--text-muted); font-size: 10px; font-weight: 700; }
.dae-input, .dae-textarea { width: 100%; box-sizing: border-box; border: 1px solid var(--border-strong); border-radius: 7px; background: var(--bg); color: var(--text-1); font: inherit; font-size: 12px; }
.dae-input { min-height: 36px; padding: 7px 9px; }
.dae-textarea { min-height: 68px; padding: 8px 9px; resize: vertical; line-height: 1.4; }
.dae-textarea--requirements { min-height: 54px; color: var(--text-2); font-size: 11px; }
.dae-empty { padding: 4px 2px; color: var(--text-muted); font-size: 13px; }
.dae-readonly-list { display: flex; flex-direction: column; gap: 6px; }
.dae-readonly-row { display: flex; align-items: center; gap: 8px; min-height: 38px; padding: 7px 9px; border: 1px solid var(--border); border-radius: var(--r-sm); background: color-mix(in srgb, var(--surface) 88%, var(--bg)); }
.dae-readonly-copy { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 2px; }
.dae-readonly-copy strong { overflow: hidden; color: var(--text-1); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.dae-readonly-copy small { overflow: hidden; color: var(--text-muted); font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.dae-lock { flex-shrink: 0; color: var(--text-muted); font-size: 9px; }
</style>
