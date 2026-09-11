<template>
  <div class="lus">
    <p class="lus-hint">{{ hint }}</p>
    <LoadingState v-if="loading" label="Загрузка заклинаний…" compact />
    <div v-else-if="error" class="lus-error" role="alert">
      <p>{{ error }}</p><ActionButton variant="secondary" @click="load">Повторить загрузку</ActionButton>
    </div>
    <template v-else>
      <div v-if="groups.length" class="lus-budgets">
        <BaseTile v-for="group in groups" :key="group.kind" class="lus-budget" :tint="group.remaining !== 0">
          <div class="lus-budget-heading"><span>{{ group.title }}</span><b>{{ group.limit == null ? group.added : `${group.added} / ${group.limit}` }}</b></div>
          <p>{{ group.remaining === 0 ? 'Всё выбрано' : group.remaining == null ? 'Число не задано в справочнике' : `Осталось выбрать: ${group.remaining}` }}</p>
          <div v-if="group.entries.length" class="lus-budget-list">
            <LevelUpItemRow v-for="entry in group.entries" :key="entry.id" :item="entry.item" :type-id="5" highlighted @details="viewId = entry.id">
              <ActionButton variant="quiet" :aria-label="`Отменить выбор «${entry.name}»`" @click="removeAddition(entry)">Отменить</ActionButton>
            </LevelUpItemRow>
          </div>
          <ActionButton v-if="group.remaining !== 0" class="lus-budget-add" variant="secondary" @click="picker = { kind: group.kind }">
            <template #icon><Plus :size="15" aria-hidden="true" /></template>{{ group.button }}
          </ActionButton>
        </BaseTile>
      </div>
      <p v-if="budget.cantripLimit != null || budget.spellLimit != null" class="lus-hint">
        Всего после повышения:
        <span v-if="budget.cantripLimit != null">заговоры {{ budget.cantripsTotal }} / {{ budget.cantripLimit }}</span>
        <span v-if="budget.cantripLimit != null && budget.spellLimit != null"> · </span>
        <span v-if="budget.spellLimit != null">заклинания {{ budget.spellsTotal }} / {{ budget.spellLimit }}</span>.
      </p>
      <div v-if="rows.length" class="lus-list">
        <div class="lus-known-heading">
          <h4>{{ budget.mode === 'spellbook' ? 'Уже в книге' : budget.mode === 'prepared' ? 'Текущие заклинания' : 'Уже известны' }}</h4>
          <span v-if="Number.isFinite(budget.replacements) && budget.replacements">Замены {{ replacementCount }} / {{ budget.replacements }} · необязательно</span>
        </div>
        <div v-for="row in rows" :key="row.original.key || row.original.id" class="lus-existing">
          <div v-if="row.replaced" class="lus-replacement-label">Вместо «{{ row.original.name }}»</div>
          <LevelUpItemRow :item="row.entry.item" :type-id="5" :highlighted="row.replaced" @details="viewId = row.entry.id">
            <ActionButton v-if="row.replaced" variant="quiet" :aria-label="`Отменить замену «${row.original.name}»`" @click="undoReplacement(row)">Отменить</ActionButton>
            <ActionButton v-if="row.original.level > 0 && budget.replacements" variant="quiet" :disabled="!canReplace(row)" :aria-label="`Заменить «${row.entry.name}»`" @click="openReplacement(row)">
              <template #icon><ArrowLeftRight :size="14" aria-hidden="true" /></template>Заменить
            </ActionButton>
          </LevelUpItemRow>
        </div>
      </div>
      <p v-if="groups.some(group => group.remaining !== 0)" class="lus-hint">Можно завершить повышение и выбрать оставшиеся новые заклинания позже в листе.</p>
    </template>
    <ItemPickerModal
      v-if="picker" :item-type-ids="[5]" :exclude-items="excludedIds" :fixed-filters="pickerFilters"
      :item-eligibility="pickerEligibility" :title="pickerTitle" search-placeholder="Поиск заклинания…"
      @pick="add" @close="picker = null"
    />
    <ItemViewModal v-if="viewId != null" :item-type-id="5" :item-id="viewId" @close="viewId = null" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ActionButton, BaseTile, LoadingState } from '@sylvieshare/share-ui'
import { ArrowLeftRight, Plus } from '@lucide/vue'
import ItemPickerModal from '@/features/handbook/components/ItemPickerModal.vue'
import ItemViewModal from '@/features/handbook/components/ItemViewModal.vue'
import LevelUpItemRow from './LevelUpItemRow.vue'
import { useLevelUpSpellSelection } from './useLevelUpSpellSelection'
const props = defineProps({ context: { type: Object, required: true }, existingSpells: { type: Array, default: () => [] } })
const emit = defineEmits(['change'])
const viewId = ref(null)
const { loading, error, load, rows, additions, budget, replacementCount, picker, pickerTitle, hint,
  excludedIds, pickerFilters, pickerEligibility, canReplace, openReplacement, add, removeAddition, undoReplacement,
} = useLevelUpSpellSelection(props, emit)
const groups = computed(() => [
  { kind: 'cantrip', title: 'Новые заговоры', button: 'Выбрать заговор', limit: budget.value.cantrips, added: budget.value.cantripsAdded, remaining: budget.value.cantripsRemaining },
  { kind: 'spell', title: budget.value.mode === 'spellbook' ? 'Добавить в книгу' : 'Новые заклинания', button: 'Выбрать заклинание', limit: budget.value.spells, added: budget.value.spellsAdded, remaining: budget.value.spellsRemaining },
].filter(group => group.limit !== 0 || group.added > 0).map(group => ({
  ...group,
  entries: additions.value.filter(entry => (entry.level === 0) === (group.kind === 'cantrip')),
})))
</script>

<style scoped>
.lus, .lus-list { display: grid; gap: 10px; min-width: 0; }
.lus { gap: 18px; }
.lus-hint, .lus-budget p { margin: 0; color: var(--text-muted); font-size: 12px; line-height: 1.6; }
.lus-budgets { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; }
.lus-budget { display: flex; flex-direction: column; gap: 12px; min-width: 0; padding: 16px; }
.lus-budget-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 14px; font-weight: 600; color: var(--text-1); }
.lus-budget-heading b { color: var(--accent-soft); font-variant-numeric: tabular-nums; white-space: nowrap; }
.lus-budget-list { display: grid; gap: 8px; min-width: 0; }
.lus-budget-add { align-self: flex-start; }
.lus-list h4 { margin: 0; color: var(--text-2); font-size: 12px; font-weight: 600; }
.lus-known-heading { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 8px; }
.lus-known-heading > span { color: var(--text-muted); font-size: 11px; }
.lus-replacement-label { color: var(--accent-soft); font-size: 11px; padding: 0 8px 6px; }
.lus-error { color: var(--danger); font-size: 12px; }
@media (max-width: 440px) { .lus-budget-add { align-self: stretch; } }
</style>
