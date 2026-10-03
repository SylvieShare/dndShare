<template>
  <div class="meeting-navigation" :class="{ 'meeting-navigation--readonly': readOnly }">
    <component :is="readOnly ? 'div' : 'nav'" class="meeting-navigation__list" :role="readOnly ? 'list' : undefined" :aria-label="readOnly ? 'Сессии кампании' : 'Сессии дневника'">
      <section v-for="group in groups" :key="group.key" class="meeting-navigation__group" :aria-label="group.label">
        <SectionLabel class="meeting-navigation__heading" role="heading" aria-level="3" :title="group.label" line>
          <template #actions><span class="meeting-navigation__group-count">{{ group.items.length }}</span></template>
        </SectionLabel>
        <component :is="readOnly ? 'div' : 'button'" v-for="row in group.items" :key="row.id" :type="readOnly ? undefined : 'button'" :role="readOnly ? 'listitem' : undefined" class="meeting-navigation__row"
          :class="{ 'meeting-navigation__row--selected': row.id === selectedId, 'meeting-navigation__row--next': group.key === 'next', 'meeting-navigation__row--past': group.key === 'past' }"
          :aria-current="!readOnly && row.id === selectedId ? 'true' : undefined" :aria-label="readOnly ? undefined : `Сессия #${row.number}: ${row.name}`" :disabled="readOnly ? undefined : disabled" :title="readOnly ? row.name : undefined"
          @click="!readOnly && $emit('select', row.id)">
          <span class="meeting-navigation__number">{{ String(row.number).padStart(2, '0') }}</span>
          <span class="meeting-navigation__copy"><strong>{{ row.name }}</strong><span>{{ occurrenceDate(row.date, { day: 'numeric', month: 'short', year: 'numeric' }) }}</span></span>
          <span v-if="!readOnly && row.entryCount" class="meeting-navigation__count" :title="`Записей: ${row.entryCount}`">{{ row.entryCount }}</span>
        </component>
      </section>
    </component>
    <div v-if="!readOnly" class="meeting-navigation__picker">
      <ValueSelect :model-value="selectedId" :options="options" :disabled="disabled" aria-label="Выбрать сессию" placeholder="Выберите сессию"
        searchable search-placeholder="Найти сессию…" search-aria-label="Найти сессию" empty-label="Сессия не найдена" @update:model-value="$emit('select', $event)" />
    </div>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { SectionLabel, ValueSelect } from '@sylvieshare/share-ui'
import { occurrenceDate } from '../lib/sessionOccurrences'
const props = defineProps({ groups: { type: Array, default: () => [] }, selectedId: Number, disabled: Boolean, readOnly: Boolean })
defineEmits(['select'])
const options = computed(() => props.groups.flatMap(group => group.items.map(row => ({ value: row.id, label: `#${row.number} · ${row.name} · ${group.label.toLowerCase()}` }))))
</script>
<style scoped>
.meeting-navigation { min-width: 0; min-height: 0; }
.meeting-navigation__list { height: 100%; overflow-y: auto; padding-right: 12px; scrollbar-width: thin; }
.meeting-navigation__group { margin-bottom: 18px; }
.meeting-navigation__heading { margin: 0 8px 7px; }
.meeting-navigation__group-count { font-weight: 400; letter-spacing: 0; }
.meeting-navigation__row { position: relative; display: flex; align-items: flex-start; gap: 9px; width: 100%; min-height: 56px; padding: 11px 8px; border: 1px solid transparent; border-radius: 8px; background: transparent; color: var(--text-muted); text-align: left; font: inherit; cursor: pointer; }
.meeting-navigation__row:hover:not(:disabled) { background: var(--surface-raised); }
.meeting-navigation__row--selected { border-color: color-mix(in srgb, var(--accent) 30%, var(--border)); background: color-mix(in srgb, var(--accent) 8%, var(--surface)); }
.meeting-navigation__row--selected::before { position: absolute; inset: 10px auto 10px -1px; width: 2px; border-radius: 2px; background: var(--accent); content: ''; }
.meeting-navigation__number { flex: none; width: 22px; padding-top: 1px; color: var(--text-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
.meeting-navigation__row--next .meeting-navigation__number, .meeting-navigation__row--selected .meeting-navigation__number { color: var(--accent); }
.meeting-navigation__copy { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 5px; }
.meeting-navigation__copy strong { display: -webkit-box; overflow: hidden; -webkit-line-clamp: 2; -webkit-box-orient: vertical; color: var(--text-2); font-size: 12px; font-weight: 600; line-height: 1.4; overflow-wrap: anywhere; }
.meeting-navigation__row--selected strong { color: var(--text-1); }
.meeting-navigation__row--past .meeting-navigation__copy strong { color: var(--text-muted); font-weight: 500; }
.meeting-navigation__row--past .meeting-navigation__number { color: var(--text-muted); }
.meeting-navigation__row--past.meeting-navigation__row--selected .meeting-navigation__copy strong { color: var(--text-2); font-weight: 600; }
.meeting-navigation__copy > span { font-size: 10px; }
.meeting-navigation__count { padding-top: 2px; font-size: 10px; font-variant-numeric: tabular-nums; }
.meeting-navigation__row:disabled { cursor: default; opacity: .6; }
.meeting-navigation__row:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.meeting-navigation__picker { display: none; }
@container session-journal (max-width: 620px) { .meeting-navigation__list { display: none; } .meeting-navigation__picker { display: block; } }
.meeting-navigation--readonly .meeting-navigation__list { display: block; padding-right: 4px; }
.meeting-navigation--readonly .meeting-navigation__row { cursor: default; }
.meeting-navigation--readonly .meeting-navigation__row:hover { background: transparent; }
</style>
