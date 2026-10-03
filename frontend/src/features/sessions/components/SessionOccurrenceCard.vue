<template>
  <BaseTile class="occurrence-card" :class="{ 'occurrence-card--next': next }">
    <div class="occurrence-card__date" aria-hidden="true">
      <strong>{{ occurrence.date ? occurrenceDate(occurrence.date, { day: 'numeric' }) : '—' }}</strong>
      <span>{{ occurrence.date ? occurrenceDate(occurrence.date, { month: 'short' }) : 'без даты' }}</span>
    </div>
    <div class="occurrence-card__copy">
      <span class="occurrence-card__number">Сессия #{{ occurrence.number }}<span v-if="next" class="occurrence-card__next">{{ occurrence.date === localDate() ? 'Сегодня' : 'Следующая' }}</span></span>
      <h3>{{ occurrence.name }}</h3>
      <time v-if="occurrence.date" :datetime="occurrence.date">{{ occurrenceDate(occurrence.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }}</time>
      <span v-else class="occurrence-card__undated">Дата не задана</span>
    </div>
    <div class="occurrence-card__actions">
      <button type="button" class="occurrence-card__journal" :aria-label="`Дневник сессии #${occurrence.number}`" @click="$emit('journal', occurrence)">
        <NotebookPen :size="17" /><span>Дневник</span><small v-if="occurrence.entryCount">{{ occurrence.entryCount }}</small>
      </button>
      <button v-if="editable" type="button" :aria-label="`Редактировать сессию #${occurrence.number}`" @click="$emit('edit', occurrence)"><Pencil :size="16" /></button>
      <button v-if="editable" type="button" class="occurrence-card__remove" :aria-label="`Удалить сессию #${occurrence.number}`" @click="$emit('remove', occurrence)"><Trash2 :size="16" /></button>
    </div>
  </BaseTile>
</template>
<script setup>
import { BaseTile } from '@sylvieshare/share-ui'
import { NotebookPen, Pencil, Trash2 } from '@lucide/vue'
import { localDate, occurrenceDate } from '../lib/sessionOccurrences'
defineProps({ occurrence: { type: Object, required: true }, editable: Boolean, next: Boolean })
defineEmits(['journal', 'edit', 'remove'])
</script>
<style scoped>
.occurrence-card { display: flex; align-items: center; gap: 18px; padding: 18px 20px; }
.occurrence-card--next { border-color: color-mix(in srgb, var(--accent) 55%, var(--border)); background: color-mix(in srgb, var(--accent) 7%, var(--surface)); }
.occurrence-card__date { display: flex; flex: none; flex-direction: column; justify-content: center; align-items: center; gap: 3px; width: 62px; min-height: 68px; border-radius: 12px; background: color-mix(in srgb, var(--accent) 10%, var(--surface)); color: var(--accent); }
.occurrence-card__date strong { font: 32px/1 var(--font-display); }
.occurrence-card__date span { font-size: 11px; }
.occurrence-card__copy { flex: 1; min-width: 0; }
.occurrence-card__number { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; color: var(--text-muted); font-size: 11px; font-weight: 650; }
.occurrence-card__next { padding: 3px 7px; border-radius: 5px; background: color-mix(in srgb, var(--accent) 14%, transparent); color: var(--accent); }
.occurrence-card h3 { margin: 6px 0; color: var(--text-1); font: 20px/1.3 var(--font-display); overflow-wrap: anywhere; }
.occurrence-card time, .occurrence-card__undated { color: var(--text-muted); font-size: 12px; }
.occurrence-card__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
.occurrence-card__actions button { display: inline-flex; justify-content: center; align-items: center; gap: 7px; min-height: 38px; min-width: 38px; padding: 7px; border: 0; border-radius: 8px; background: transparent; color: var(--text-muted); font: inherit; font-size: 12px; cursor: pointer; }
.occurrence-card__actions button:hover { background: var(--surface-raised); color: var(--text-1); }
.occurrence-card__actions .occurrence-card__journal { color: var(--accent); }
.occurrence-card__actions .occurrence-card__remove:hover { color: var(--danger); }
@media (max-width: 640px) { .occurrence-card { gap: 12px; padding: 14px; flex-wrap: wrap; } .occurrence-card__date { width: 50px; } .occurrence-card__copy { flex-basis: calc(100% - 62px); } .occurrence-card__actions { margin-left: 62px; } .occurrence-card h3 { font-size: 18px; } }
</style>
