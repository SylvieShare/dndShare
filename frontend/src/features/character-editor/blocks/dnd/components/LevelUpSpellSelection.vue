<template>
  <div class="lus">
    <div class="lus-head">
      <div>
        <strong>Заклинания {{ context.label }}</strong>
        <p>{{ hint }}</p>
      </div>
      <div class="lus-counts">
        <span v-if="cantripLimit != null">Заговоры {{ cantripCount }} / {{ cantripLimit }}</span>
        <span v-if="spellLimit != null">Заклинания {{ spellCount }} / {{ spellLimit }}</span>
      </div>
    </div>

    <p v-if="loading" class="lus-muted">Загрузка заклинаний…</p>
    <div v-else class="lus-chips">
      <button
        v-for="entry in selected"
        :key="entry.key || entry.id"
        type="button"
        class="lus-chip"
        :title="`Убрать: ${entry.name}`"
        @click="remove(entry.key || entry.id)"
      >
        {{ entry.name }} <small>{{ entry.level === 0 ? 'заговор' : `${entry.level} круг` }}</small> ×
      </button>
      <span v-if="!selected.length" class="lus-muted">Пока ничего не выбрано.</span>
    </div>

    <button type="button" class="lus-add" @click="pickerOpen = true">+ Добавить заклинание</button>

    <ItemPickerModal
      v-if="pickerOpen"
      :item-type-ids="[5]"
      :exclude-items="excludedIds"
      :fixed-filters="pickerFilters"
      :item-eligibility="pickerEligibility"
      :title="`Заклинания · ${context.label}`"
      search-placeholder="Поиск заклинания…"
      @pick="add"
      @close="pickerOpen = false"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'

import ItemPickerModal from '@/features/handbook/components/ItemPickerModal.vue'
import { itemsApi } from '@/shared/api/itemsApi'

const props = defineProps({
  context: { type: Object, required: true },
  existingSpells: { type: Array, default: () => [] },
})
const emit = defineEmits(['change'])

const loading = ref(true)
const pickerOpen = ref(false)
const selected = ref([])
const originalIds = ref(new Set())

const rules = computed(() => props.context.rules || {})
const cantripCount = computed(() => selected.value.filter((entry) => entry.level === 0).length)
const spellCount = computed(() => selected.value.filter((entry) => entry.level > 0).length)
const cantripLimit = computed(() => rules.value.hasKnownProgression ? rules.value.cantripsKnown : null)
const spellLimit = computed(() => rules.value.hasKnownProgression ? rules.value.spellsKnown : null)
const selectedIds = computed(() => new Set(selected.value.map((entry) => String(entry.id))))
const newLeveledCount = computed(() => selected.value
  .filter((entry) => entry.level > 0 && !originalIds.value.has(String(entry.id))).length)
const excludedIds = computed(() => [...new Set([
  ...props.existingSpells.filter((entry) => !isSelectableClassSpell(entry)).map((entry) => entry.id),
  ...selected.value.map((entry) => entry.id),
])])
const pickerFilters = computed(() => ({
  ...(rules.value.listClassId != null ? { 'classes.id': [rules.value.listClassId] } : {}),
  lvl: Array.from({ length: Math.max(0, Number(props.context.maxSpellLevel) || 0) + 1 }, (_, index) => index),
}))
const hint = computed(() => {
  if (rules.value.selectionMode === 'prepared') return 'Измени список подготовленных заклинаний для нового уровня.'
  if (rules.value.selectionMode === 'spellbook') {
    return rules.value.levelUpChoices
      ? `Добавь до ${rules.value.levelUpChoices} новых заклинаний в книгу или замени текущий выбор.`
      : 'Добавь новые заклинания в книгу или измени текущий выбор.'
  }
  return 'Изучи новые заклинания или замени уже известные.'
})

function isSelectableClassSpell(entry) { return entry?.id != null }

function pickerEligibility(item) {
  const level = Number(item?.data?.lvl)
  const reasons = []
  if (rules.value.listClassId != null
    && !(item?.data?.classes || []).some((entry) => String(entry?.id ?? entry) === String(rules.value.listClassId))) {
    reasons.push('Не входит в список этого класса')
  }
  if (level > Number(props.context.maxSpellLevel)) reasons.push('Круг пока недоступен этому классу')
  if (selectedIds.value.has(String(item?.id))) reasons.push('Уже выбрано')
  if (level === 0 && cantripLimit.value != null && cantripCount.value >= cantripLimit.value) {
    reasons.push('Достигнут лимит известных заговоров')
  }
  if (level > 0 && spellLimit.value != null && spellCount.value >= spellLimit.value) {
    reasons.push('Достигнут лимит известных заклинаний')
  }
  if (level > 0 && rules.value.selectionMode === 'spellbook' && rules.value.levelUpChoices
    && !originalIds.value.has(String(item?.id)) && newLeveledCount.value >= rules.value.levelUpChoices) {
    reasons.push('Все новые заклинания этого уровня уже выбраны')
  }
  return { eligible: reasons.length === 0, reasons }
}

function notify() {
  emit('change', {
    tab: { ...props.context.tab, spells: [] },
    entries: selected.value.map(({ id, level, key }) => ({ id, level, ...(key ? { key } : {}) })),
  })
}

function add(item) {
  if (!pickerEligibility(item).eligible) return
  selected.value.push({ id: item.id, name: item.name, level: Number(item.data?.lvl) || 0 })
  pickerOpen.value = false
  notify()
}

function remove(key) {
  selected.value = selected.value.filter((entry) => String(entry.key || entry.id) !== String(key))
  notify()
}

onMounted(async () => {
  try {
    const refs = props.existingSpells.filter(isSelectableClassSpell)
    originalIds.value = new Set(refs.map((entry) => String(entry.id)))
    const ids = refs.map((entry) => entry.id)
    const response = ids.length ? await itemsApi.byIds(ids) : { items: [] }
    const itemMap = Object.fromEntries((response?.items || []).map((item) => [String(item.id), item]))
    selected.value = refs.map((entry) => {
      const item = itemMap[String(entry.id)]
      return {
        id: entry.id,
        key: entry.key,
        name: item?.name || `Заклинание #${entry.id}`,
        level: Number(item?.data?.lvl) || 0,
      }
    })
  } finally {
    loading.value = false
    notify()
  }
})

watch(() => props.context.tab?.key, () => { pickerOpen.value = false })
</script>

<style scoped>
.lus { display: grid; gap: 10px; }
.lus-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.lus-head strong { color: var(--text-1); font-size: 13px; }
.lus-head p { margin: 3px 0 0; color: var(--text-muted); font-size: 11px; }
.lus-counts { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; color: var(--text-2); font-size: 11px; white-space: nowrap; }
.lus-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.lus-chip, .lus-add { border: 1px solid var(--border); border-radius: 8px; background: color-mix(in srgb, var(--accent) 8%, transparent); color: var(--text-1); cursor: pointer; font: inherit; font-size: 12px; }
.lus-chip { padding: 5px 8px; }
.lus-chip small { color: var(--text-muted); }
.lus-add { justify-self: start; padding: 6px 10px; border-style: dashed; color: var(--accent-soft); }
.lus-muted { margin: 0; color: var(--text-muted); font-size: 11px; }
</style>
