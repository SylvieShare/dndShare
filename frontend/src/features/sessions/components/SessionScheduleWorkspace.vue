<template>
  <section class="session-schedule" data-tutorial="session-schedule" aria-label="Сессии кампании">
    <header class="session-schedule__header">
      <div><span class="session-schedule__kicker"><CalendarDays :size="15" /> Календарь кампании</span><h2>Сессии</h2><p>Следующая встреча и история ваших игр</p></div>
      <button v-if="editable" type="button" class="session-schedule__create" :disabled="loading || busy" @click="edit()"><Plus :size="18" /> Новая сессия</button>
    </header>
    <LoadingState v-if="loading" label="Загружаем сессии…" />
    <template v-else>
      <div v-if="error && !draft && !removing" class="session-schedule__error" role="alert">{{ error }} <button type="button" @click="load()">Повторить загрузку</button></div>
      <div v-if="groups.next" class="session-schedule__group">
        <h3>Ближайшая сессия</h3>
        <SessionOccurrenceCard :occurrence="groups.next" :editable="editable" next @journal="$emit('journal', $event)" @edit="edit" @remove="removing = $event" />
      </div>
      <p v-else class="session-schedule__empty">{{ occurrences.length ? 'Следующая сессия пока не запланирована.' : editable ? 'Запланируйте первую сессию — у неё сразу появится свой дневник.' : 'Мастер пока не запланировал сессии.' }}</p>
      <div v-for="group in otherGroups" :key="group.key" class="session-schedule__group">
        <h3>{{ group.label }} <span>{{ group.items.length }}</span></h3>
        <SessionOccurrenceCard v-for="occurrence in group.items" :key="occurrence.id" :occurrence="occurrence" :editable="editable"
          @journal="$emit('journal', $event)" @edit="edit" @remove="removing = $event" />
      </div>
    </template>
    <SessionOccurrenceModal v-if="draft && editable" :occurrence="draft" :busy="busy" :error="error" @save="save" @close="draft = null; error = ''" />
    <ConfirmDialog v-if="removing && editable" title="Удалить сессию?" :loading="busy" confirm-label="Удалить"
      :message="`Сессия #${removing.number} «${removing.name}» и все записи её дневника будут удалены.${error ? '\n' + error : ''}`"
      @confirm="remove" @cancel="removing = null; error = ''" />
  </section>
</template>
<script setup>
import { computed } from 'vue'
import { CalendarDays, Plus } from '@lucide/vue'
import { ConfirmDialog, LoadingState } from '@sylvieshare/share-ui'
import { useSessionOccurrences } from '../composables/useSessionOccurrences'
import SessionOccurrenceCard from './SessionOccurrenceCard.vue'
import SessionOccurrenceModal from './SessionOccurrenceModal.vue'
const props = defineProps({ sessionUuid: { type: String, required: true }, editable: Boolean })
defineEmits(['journal'])
const { occurrences, loading, busy, error, groups, draft, removing, load, edit, save, remove } = useSessionOccurrences(props.sessionUuid)
const otherGroups = computed(() => [
  { key: 'future', label: 'Будущие сессии', items: groups.value.future },
  { key: 'past', label: 'Прошедшие сессии', items: groups.value.past },
  { key: 'undated', label: 'Без даты', items: groups.value.undated },
].filter(group => group.items.length))
</script>
<style scoped>
.session-schedule { box-sizing: border-box; display: flex; flex-direction: column; gap: 26px; width: 100%; max-width: 1040px; height: 100%; overflow-y: auto; margin-inline: auto; padding: 4px 8px 28px 0; color: var(--text-1); scrollbar-gutter: stable; }
.session-schedule__header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; }
.session-schedule__kicker { display: inline-flex; align-items: center; gap: 8px; color: var(--accent); font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.session-schedule h2 { margin: 8px 0; font: 32px/1.2 var(--font-display); }
.session-schedule__header p { margin: 0; color: var(--text-muted); font-size: 13px; }
.session-schedule__create { display: inline-flex; align-items: center; gap: 8px; border: 0; border-radius: 9px; padding: 11px 15px; background: var(--accent); color: var(--text-on-accent); font: 600 13px var(--font-ui); cursor: pointer; }
.session-schedule__create:disabled { opacity: .5; cursor: default; }
.session-schedule__group { display: flex; flex-direction: column; gap: 10px; }
.session-schedule__group > h3 { display: flex; align-items: center; gap: 10px; margin: 0 0 2px; color: var(--text-muted); font-size: 12px; font-weight: 650; }
.session-schedule__group > h3 span { font-variant-numeric: tabular-nums; opacity: .7; }
.session-schedule__empty { padding: 26px; border: 1px dashed var(--border-strong); border-radius: 12px; color: var(--text-muted); font-size: 13px; line-height: 1.6; }
.session-schedule__error { color: var(--danger); font-size: 13px; }
.session-schedule__error button { border: 0; background: transparent; color: var(--accent); cursor: pointer; }
</style>
