<template>
  <div class="journal-schedule-link">
    <span v-if="section?.number">Сессия #{{ section.number }} · {{ occurrenceDate(section.date) }}</span>
    <RouterLink :to="{ name: 'Session', params: { uuid: sessionUuid }, query: { view: 'journal', ...(section?.occurrenceId ? { occurrence: section.occurrenceId } : {}) } }" @click="$emit('schedule')"><CalendarDays :size="15" /> Открыть дневник кампании</RouterLink>
  </div>
</template>
<script setup>
import { RouterLink } from 'vue-router'
import { CalendarDays } from '@lucide/vue'
import { occurrenceDate } from '@/features/sessions/lib/sessionOccurrences'
defineProps({ sessionUuid: { type: String, required: true }, section: { type: Object, default: null } })
defineEmits(['schedule'])
</script>
<style scoped>
.journal-schedule-link { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; color: var(--text-muted); font-size: 12px; }
.journal-schedule-link a { display: inline-flex; align-items: center; gap: 7px; color: var(--accent); text-decoration: none; }
</style>
