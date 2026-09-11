<template>
  <div class="lus">
    <p class="lus-hint">{{ hint }}</p>
    <LoadingState v-if="loading" label="Загрузка заклинаний…" compact />
    <div v-else-if="error" class="lus-error" role="alert">
      <p>{{ error }}</p><ActionButton variant="secondary" @click="load">Повторить загрузку</ActionButton>
    </div>
    <template v-else>
      <div class="lus-budgets">
        <BaseTile v-for="group in groups" :key="group.kind" class="lus-budget" :tint="group.remaining !== 0">
          <div class="lus-budget-heading"><span>{{ group.title }}</span><b>{{ group.limit == null ? group.added : `${group.added} / ${group.limit}` }}</b></div>
          <p>{{ group.remaining === 0 ? (group.limit ? 'Всё выбрано' : 'На этом уровне новых нет') : group.remaining == null ? 'Число не задано в справочнике' : `Осталось выбрать: ${group.remaining}` }}</p>
          <ActionButton variant="secondary" :disabled="group.remaining === 0" @click="picker = { kind: group.kind }">
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
      <div v-if="additions.length" class="lus-list">
        <h4>Новые заклинания</h4>
        <LevelUpItemRow v-for="entry in additions" :key="entry.id" :item="entry.item" :type-id="5" highlighted @details="viewId = entry.id">
          <ActionButton variant="quiet" :aria-label="`Отменить выбор «${entry.name}»`" @click="removeAddition(entry)">Отменить</ActionButton>
        </LevelUpItemRow>
      </div>
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
      <p class="lus-hint">Можно завершить повышение и выбрать оставшиеся новые заклинания позже в листе.</p>
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
])
</script>

<style scoped>
.lus, .lus-list { display: grid; gap: 10px; min-width: 0; }
.lus { gap: 18px; }
.lus-hint, .lus-budget p { margin: 0; color: var(--text-muted); font-size: 12px; line-height: 1.6; }
.lus-budgets { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.lus-budget { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; padding: 16px; }
.lus-budget-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; font-size: 12px; color: var(--text-1); }
.lus-budget-heading b { color: var(--accent-soft); font-variant-numeric: tabular-nums; white-space: nowrap; }
.lus-budget p { flex: 1; }
.lus-budget :deep(.share-action-button) { width: 100%; padding-inline: 8px; }
.lus-list h4 { margin: 0; color: var(--text-2); font-size: 12px; font-weight: 600; }
.lus-known-heading { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 8px; }
.lus-known-heading > span { color: var(--text-muted); font-size: 11px; }
.lus-replacement-label { color: var(--accent-soft); font-size: 11px; padding: 0 8px 6px; }
.lus-error { color: var(--danger); font-size: 12px; }
@media (max-width: 440px) { .lus-budgets { grid-template-columns: 1fr; } }
</style>
