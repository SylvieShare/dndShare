<template>
  <div class="meeting-navigation">
    <nav class="meeting-navigation__list" aria-label="Сессии дневника">
      <section v-for="group in groups" :key="group.key" class="meeting-navigation__group" :aria-label="group.label">
        <h3>{{ group.label }}<span>{{ group.items.length }}</span></h3>
        <button v-for="row in group.items" :key="row.id" type="button" class="meeting-navigation__row"
          :class="{ 'meeting-navigation__row--selected': row.id === selectedId, 'meeting-navigation__row--next': group.key === 'next' }"
          :aria-current="row.id === selectedId ? 'true' : undefined" :aria-label="`Сессия #${row.number}: ${row.name}`" :disabled="disabled"
          @click="$emit('select', row.id)">
          <span class="meeting-navigation__number">{{ String(row.number).padStart(2, '0') }}</span>
          <span class="meeting-navigation__copy"><strong>{{ row.name }}</strong><span>{{ occurrenceDate(row.date, { day: 'numeric', month: 'short', year: 'numeric' }) }}</span></span>
          <span v-if="row.entryCount" class="meeting-navigation__count" :title="`Записей: ${row.entryCount}`">{{ row.entryCount }}</span>
        </button>
      </section>
    </nav>
    <div class="meeting-navigation__picker">
      <ValueSelect :model-value="selectedId" :options="options" :disabled="disabled" aria-label="Выбрать сессию" placeholder="Выберите сессию"
        searchable search-placeholder="Найти сессию…" search-aria-label="Найти сессию" empty-label="Сессия не найдена" @update:model-value="$emit('select', $event)" />
    </div>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { ValueSelect } from '@sylvieshare/share-ui'
import { occurrenceDate } from '../lib/sessionOccurrences'
const props = defineProps({ groups: { type: Array, default: () => [] }, selectedId: Number, disabled: Boolean })
defineEmits(['select'])
const options = computed(() => props.groups.flatMap(group => group.items.map(row => ({ value: row.id, label: `#${row.number} · ${row.name} · ${group.label.toLowerCase()}` }))))
</script>
<style scoped>
.meeting-navigation { min-width: 0; min-height: 0; }
.meeting-navigation__list { height: 100%; overflow-y: auto; padding-right: 12px; scrollbar-width: thin; }
.meeting-navigation__group { margin-bottom: 18px; }
.meeting-navigation__group h3 { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 0 8px 7px; color: var(--text-muted); font: 650 10px var(--font-ui); letter-spacing: .05em; text-transform: uppercase; }
.meeting-navigation__group h3 span { font-weight: 400; letter-spacing: 0; }
.meeting-navigation__row { position: relative; display: flex; align-items: flex-start; gap: 9px; width: 100%; min-height: 56px; padding: 11px 8px; border: 1px solid transparent; border-radius: 8px; background: transparent; color: var(--text-muted); text-align: left; font: inherit; cursor: pointer; }
.meeting-navigation__row:hover:not(:disabled) { background: var(--surface-raised); }
.meeting-navigation__row--selected { border-color: color-mix(in srgb, var(--accent) 30%, var(--border)); background: color-mix(in srgb, var(--accent) 8%, var(--surface)); }
.meeting-navigation__row--selected::before { position: absolute; inset: 10px auto 10px -1px; width: 2px; border-radius: 2px; background: var(--accent); content: ''; }
.meeting-navigation__number { flex: none; width: 22px; padding-top: 1px; color: var(--text-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
.meeting-navigation__row--next .meeting-navigation__number, .meeting-navigation__row--selected .meeting-navigation__number { color: var(--accent); }
.meeting-navigation__copy { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 5px; }
.meeting-navigation__copy strong { display: -webkit-box; overflow: hidden; -webkit-line-clamp: 2; -webkit-box-orient: vertical; color: var(--text-2); font-size: 12px; font-weight: 600; line-height: 1.4; overflow-wrap: anywhere; }
.meeting-navigation__row--selected strong { color: var(--text-1); }
.meeting-navigation__copy > span { font-size: 10px; }
.meeting-navigation__count { padding-top: 2px; font-size: 10px; font-variant-numeric: tabular-nums; }
.meeting-navigation__row:disabled { cursor: default; opacity: .6; }
.meeting-navigation__row:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.meeting-navigation__picker { display: none; }
@container session-journal (max-width: 620px) { .meeting-navigation__list { display: none; } .meeting-navigation__picker { display: block; } }
</style>
