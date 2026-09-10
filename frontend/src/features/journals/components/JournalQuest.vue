<template>
  <div class="journal-quest">
    <div class="journal-quest-objectives">
      <div v-for="objective in quest.objectives" :key="objective.id" class="journal-objective" :class="{ 'journal-objective--done': objective.done }">
        <CompactCheckbox :model-value="objective.done" disabled :label="objective.text || 'Пункт задания'" />
        <span>{{ objective.text || 'Без названия' }}</span>
      </div>
    </div>
    <div v-if="quest.reward" class="journal-quest-reward">{{ quest.reward }}</div>
    <div class="journal-quest-progress" :class="{ complete: progress.complete }">
      <div><span>{{ progress.complete ? 'Завершено' : 'В работе' }}</span><span>{{ progress.done }} / {{ progress.total }} пунктов</span></div>
      <progress :value="progress.done" :max="progress.total || 1" aria-label="Выполненные пункты задания" />
    </div>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { CompactCheckbox } from '@sylvieshare/share-ui'
import { normalizeJournalQuest, questProgress } from '../lib/journalQuest'
const props = defineProps({ value: Object })
const quest = computed(() => normalizeJournalQuest(props.value))
const progress = computed(() => questProgress(quest.value))
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
