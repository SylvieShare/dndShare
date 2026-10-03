<template>
  <BaseTile class="session-meetings" color="var(--accent)" framed data-tutorial="session-meetings" aria-label="Встречи кампании">
    <header class="session-meetings__header">
      <div><span class="session-meetings__kicker">Календарь кампании</span><h2><CalendarDays :size="21" /> Сессии</h2></div>
      <span class="session-meetings__count">{{ occurrences.length }}</span>
    </header>
    <LoadingState v-if="loading" label="Загружаем сессии…" />
    <template v-else-if="error">
      <p class="session-meetings__error" role="alert">{{ error }}</p>
      <ActionButton variant="quiet" @click="load()">Повторить загрузку</ActionButton>
    </template>
    <SessionJournalNavigation v-else-if="meetingGroups.length" :groups="meetingGroups" read-only />
    <p v-else class="session-meetings__empty">Мастер пока не добавил сессии.</p>
  </BaseTile>
</template>
<script setup>
import { computed } from 'vue'
import { CalendarDays } from '@lucide/vue'
import { ActionButton, BaseTile, LoadingState } from '@sylvieshare/share-ui'
import SessionJournalNavigation from './SessionJournalNavigation.vue'
import { useSessionOccurrences } from '../composables/useSessionOccurrences'
import { occurrenceGroups } from '../lib/sessionOccurrences'
const props = defineProps({ sessionUuid: { type: String, required: true } })
const { occurrences, groups, loading, error, load } = useSessionOccurrences(props.sessionUuid)
const meetingGroups = computed(() => occurrenceGroups(groups.value))
</script>
<style scoped>
.session-meetings { display: flex; flex-direction: column; gap: 18px; min-width: 0; min-height: 440px; max-height: 660px; padding: 24px; }
.session-meetings__header { display: flex; flex: none; align-items: flex-start; justify-content: space-between; gap: 12px; padding-bottom: 19px; border-bottom: 1px solid var(--border); }
.session-meetings__kicker { color: var(--text-muted); font: 750 10px/1.2 var(--font-ui); letter-spacing: .08em; text-transform: uppercase; }
.session-meetings h2 { display: flex; align-items: center; gap: 9px; margin: 8px 0 0; color: var(--text-1); font: 720 23px/1.1 var(--font-display); }
.session-meetings__count { display: grid; place-items: center; min-width: 34px; height: 34px; border-radius: 10px; background: color-mix(in srgb, var(--accent) 10%, var(--surface)); color: var(--text-2); font: 650 13px var(--font-ui); }
.session-meetings > .meeting-navigation { flex: 1; min-height: 0; }
.session-meetings__empty { display: grid; flex: 1; align-content: center; margin: 0; color: var(--text-muted); font-size: 13px; text-align: center; }
.session-meetings__error { margin: 0; color: var(--danger); font-size: 13px; line-height: 1.6; }
@media (max-width: 1000px) { .session-meetings { min-height: 280px; max-height: 520px; } }
@media (max-width: 600px) { .session-meetings { padding: 20px 16px; } }
</style>
