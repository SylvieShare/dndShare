<template>
  <div class="journal-quest">
    <div class="journal-quest-objectives">
      <div v-for="objective in displayed" :key="objective.id" class="journal-objective" :class="{ 'journal-objective--done': objective.done }">
        <JournalInlineForm v-if="active(objective)" label="Пункт задания" :busy="busy" :error="error || validationError" @save="saveObjective" @cancel="$emit('cancel')">
          <FormTextInput v-model:value="editor.value.text" aria-label="Текст пункта" placeholder="Что нужно сделать?" :maxlength="500" autofocus />
          <template #actions><RemoveButton v-if="!editor.isNew" icon="trash" label="Удалить пункт" :disabled="busy" @click="saveQuest({ objectives: quest.objectives.filter(row => row.id !== objective.id) })" /></template>
        </JournalInlineForm>
        <template v-else>
          <CompactCheckbox :model-value="objective.done" :disabled="!editable || busy || Boolean(editor)" :label="objective.text || 'Пункт задания'" @update:model-value="value => $emit('toggle', objective, value)" />
          <span>{{ objective.text || 'Без названия' }}</span>
          <JournalEditButton v-if="editable" :disabled="busy || Boolean(editor)" label="Редактировать пункт" @click="$emit('edit', 'objective', objective)" />
        </template>
      </div>
    </div>
    <JournalInlineForm v-if="editor?.kind === 'quest-toggle'" label="Сохранение отметки" :busy="busy" :error="error" @save="$emit('retry-toggle')" @cancel="$emit('cancel')" />
    <button v-if="editable && !editor && quest.objectives.length < 100" type="button" class="diary-inline-add" :disabled="busy" @click="$emit('edit', 'objective', defaultObjective(), true)"><Plus :size="15" /> Пункт задания</button>
    <JournalInlineForm v-if="editor?.kind === 'reward'" label="Награда" :busy="busy" :error="error" @save="saveQuest({ reward: editor.value })" @cancel="$emit('cancel')">
      <FormTextInput v-model:value="editor.value" aria-label="Награда" placeholder="Награда за задание" :maxlength="2000" autofocus />
    </JournalInlineForm>
    <div v-else-if="quest.reward || editable" class="journal-quest-reward"><span>{{ quest.reward || 'Добавить награду' }}</span><JournalEditButton v-if="editable" :disabled="busy || Boolean(editor)" label="Редактировать награду" @click="$emit('edit', 'reward', quest.reward)" /></div>
    <div class="journal-quest-progress" :class="{ complete: progress.complete }">
      <div><span>{{ progress.complete ? 'Завершено' : 'В работе' }}</span><span>{{ progress.done }} / {{ progress.total }} пунктов</span></div>
      <progress :value="progress.done" :max="progress.total || 1" aria-label="Выполненные пункты задания" />
    </div>
  </div>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { Plus } from '@lucide/vue'
import { CompactCheckbox, FormTextInput, RemoveButton } from '@sylvieshare/share-ui'
import JournalInlineForm from './JournalInlineForm.vue'
import JournalEditButton from './JournalEditButton.vue'
import { defaultObjective, normalizeJournalQuest, questProgress } from '../lib/journalQuest'
const props = defineProps({ value: Object, editable: Boolean, busy: Boolean, editor: Object, error: String })
const emit = defineEmits(['edit', 'save', 'cancel', 'toggle', 'retry-toggle'])
const validationError = ref('')
watch(() => props.editor?.value, () => { validationError.value = '' }, { deep: true })
const quest = computed(() => normalizeJournalQuest(props.value))
const progress = computed(() => questProgress(quest.value))
const displayed = computed(() => props.editor?.kind === 'objective' && props.editor.isNew ? [...quest.value.objectives, props.editor.value] : quest.value.objectives)
const active = row => props.editor?.kind === 'objective' && props.editor.value.id === row.id
const saveQuest = patch => emit('save', { quest: { ...quest.value, ...patch } })
function saveObjective() {
  const row = { ...props.editor.value, text: props.editor.value.text.trim() }
  if (!row.text) { validationError.value = 'Введите текст пункта'; return }
  saveQuest({ objectives: props.editor.isNew ? [...quest.value.objectives, row] : quest.value.objectives.map(old => old.id === row.id ? row : old) })
}
</script>
<style scoped>
.journal-quest { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.journal-objective { display: flex; gap: 12px; align-items: center; min-height: 42px; font-size: 13px; }
.journal-objective > span { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.journal-objective--done > span { color: var(--text-muted); text-decoration: line-through; text-decoration-color: var(--border-strong); }
.journal-objective :deep(.journal-inline-form) { width: 100%; padding: 0; }
.journal-objective :deep(.share-compact-checkbox:disabled) { opacity: .7; }
.journal-quest-reward { display: flex; align-items: center; gap: 8px; color: var(--accent-soft); font-size: 12px; overflow-wrap: anywhere; }
.journal-quest-progress { margin-top: 4px; color: var(--accent-soft); }
.journal-quest-progress > div { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 8px; font: 11px var(--font-ui); }
.journal-quest-progress > div > :last-child { color: var(--text-muted); font-variant-numeric: tabular-nums; }
.journal-quest-progress progress { display: block; appearance: none; border: 0; width: 100%; height: 3px; background: var(--surface-active); color: var(--accent); }
.journal-quest-progress progress::-webkit-progress-bar { background: var(--surface-active); }
.journal-quest-progress progress::-webkit-progress-value { background: var(--accent); }
.journal-quest-progress progress::-moz-progress-bar { background: var(--accent); }
.journal-quest-progress.complete { color: var(--success); }
@media (max-width: 720px) { .journal-objective { min-height: 44px; } }
</style>
