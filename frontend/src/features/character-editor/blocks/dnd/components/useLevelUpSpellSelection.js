import { computed, onMounted, ref, watch } from 'vue'
import { itemsApi } from '@/shared/api/itemsApi'
import { levelUpSpellBudget, levelUpSpellEligibility } from '../lib/levelUpSpellPlan'

export function useLevelUpSpellSelection(props, emit) {
  const loading = ref(true)
  const error = ref('')
  const original = ref([])
  const counted = ref([])
  const additions = ref([])
  const replacements = ref({})
  const picker = ref(null)
  const entryKey = entry => String(entry.key || entry.id)
  const rows = computed(() => original.value.map(entry => ({
    original: entry, entry: replacements.value[entryKey(entry)] || entry,
    replaced: !!replacements.value[entryKey(entry)],
  })))
  const selected = computed(() => [...rows.value.map(row => row.entry), ...additions.value])
  const budget = computed(() => levelUpSpellBudget(props.context, original.value, additions.value, counted.value))
  const replacementCount = computed(() => Object.keys(replacements.value).length)
  const replacing = computed(() => rows.value.find(row => entryKey(row.original) === picker.value?.replaceKey))
  const excludedIds = computed(() => [...new Set([
    ...selected.value.map(entry => entry.id),
    ...(props.context.excludedSpellIds || []),
    ...original.value.map(entry => entry.id),
  ])])
  const pickerFilters = computed(() => ({
    ...(props.context.rules?.listClassId != null ? { 'classes.id': [props.context.rules.listClassId] } : {}),
    lvl: Array.from({ length: Math.max(0, Number(props.context.maxSpellLevel) || 0) + 1 }, (_, index) => index)
      .filter(level => picker.value?.kind === 'cantrip' ? level === 0 : level > 0),
  }))
  const pickerTitle = computed(() => replacing.value ? `Заменить «${replacing.value.entry.name}»` : picker.value?.kind === 'cantrip' ? 'Выбрать новый заговор' : 'Выбрать новое заклинание')
  const hint = computed(() => {
    if (budget.value.mode === 'spellbook') return 'Новые заклинания пополнят книгу. Уже записанные остаются в ней.'
    if (budget.value.mode === 'prepared') return 'Здесь можно обновить подготовленные заклинания. Их также можно менять после долгого отдыха.'
    return budget.value.replacements ? 'Удалять известные заклинания не нужно. Дополнительно можно заменить одно — это не расходует выбор нового заклинания.' : 'Выберите заклинания для нового класса. Замена станет доступна при следующем повышении.'
  })

  function canReplace(row) {
    return row.original.level > 0 && (row.replaced || replacementCount.value < budget.value.replacements)
  }
  function openReplacement(row) {
    if (!canReplace(row)) return
    picker.value = { kind: 'spell', replaceKey: entryKey(row.original) }
  }
  function pickerEligibility(item) {
    const result = levelUpSpellEligibility({
      item, context: props.context, original: original.value, additions: additions.value,
      selected: selected.value, counted: counted.value, replacing: replacing.value?.entry,
      replacementCount: replacementCount.value, alreadyReplaced: replacing.value?.replaced,
      excludedIds: excludedIds.value,
    })
    if ((Number(item?.data?.lvl) === 0) !== (picker.value?.kind === 'cantrip')) result.reasons.push('Выберите заклинание нужного типа')
    return { eligible: !result.reasons.length, reasons: result.reasons }
  }
  function add(item) {
    if (!pickerEligibility(item).eligible) return
    const entry = { id: item.id, name: item.name, level: Number(item.data.lvl), item }
    if (replacing.value) replacements.value[entryKey(replacing.value.original)] = entry
    else additions.value.push(entry)
    picker.value = null
  }
  function removeAddition(entry) { additions.value = additions.value.filter(other => other !== entry) }
  function undoReplacement(row) { delete replacements.value[entryKey(row.original)] }

  async function load() {
    loading.value = true
    error.value = ''
    try {
      const refs = props.existingSpells.filter(entry => entry?.id != null)
      const countedRefs = props.context.countedGrants || []
      const ids = [...new Set([...refs, ...countedRefs].map(entry => entry.id))]
      const response = ids.length ? await itemsApi.byIds(ids) : { items: [] }
      const itemMap = new Map((response?.items || []).map(item => [String(item.id), item]))
      const resolve = entry => {
        const item = itemMap.get(String(entry.id))
        if (!item || item.data?.lvl == null) throw new Error('Missing spell')
        return { id: entry.id, key: entry.key, name: item.name, level: Number(item.data.lvl), item }
      }
      original.value = refs.map(resolve)
      counted.value = countedRefs.map(resolve)
    } catch {
      error.value = 'Не удалось загрузить известные заклинания. Повторите загрузку, чтобы сохранить их без потерь.'
    } finally { loading.value = false }
  }
  watch([selected, loading, error], () => emit('change', {
    ready: !loading.value && !error.value,
    tab: { ...props.context.tab, spells: [] },
    entries: selected.value.map(({ id, level, key }) => ({ id, level, ...(key ? { key } : {}) })),
  }), { immediate: true, deep: true })
  onMounted(load)
  return { loading, error, load, rows, additions, budget, replacementCount, picker, pickerTitle, hint,
    excludedIds, pickerFilters, pickerEligibility, canReplace, openReplacement, add, removeAddition, undoReplacement }
}
