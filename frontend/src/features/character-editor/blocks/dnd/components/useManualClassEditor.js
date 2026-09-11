import { computed, ref } from 'vue'
import { itemsApi } from '@/shared/api/itemsApi'
import { CLASS_ITEM_TYPE, SUBCLASS_ITEM_TYPE, originChildren } from '@/shared/lib/dndItemTypes'
import { classEntriesOf, LEVEL_CAP } from '../lib/levelUp'

export function useManualClassEditor(values, scope = {}) {
  let nextKey = 0
  const rows = ref(classEntriesOf(values()).map(entry => ({ ...entry, key: nextKey++ })))
  const classes = ref([])
  const subclasses = ref([])
  const loading = ref(true)
  const loadError = ref('')
  const total = computed(() => rows.value.reduce((sum, row) => sum + Number(row.level || 0), 0))
  const validation = computed(() => {
    if (!rows.value.length) return 'Добавьте хотя бы один класс.'
    if (rows.value.some(row => !row.id)) return 'Выберите класс для каждой строки.'
    if (new Set(rows.value.map(row => String(row.id))).size !== rows.value.length) return 'Каждый класс можно добавить только один раз.'
    if (rows.value.some(row => !Number.isInteger(Number(row.level)) || row.level < 1 || row.level > LEVEL_CAP)) {
      return `Уровень каждого класса должен быть от 1 до ${LEVEL_CAP}.`
    }
    return total.value > LEVEL_CAP ? `Общий уровень не может превышать ${LEVEL_CAP}.` : ''
  })
  const canSave = computed(() => !loading.value && !loadError.value && !validation.value)

  async function load() {
    loading.value = true
    loadError.value = ''
    try {
      const [classResult, subclassResult] = await Promise.all([
        itemsApi.listAll(CLASS_ITEM_TYPE, scope),
        itemsApi.listAll(SUBCLASS_ITEM_TYPE, scope),
      ])
      classes.value = classResult.items
      subclasses.value = subclassResult.items
    } catch {
      loadError.value = 'Не удалось загрузить классы и подклассы. Повторите загрузку, чтобы продолжить.'
    } finally {
      loading.value = false
    }
  }

  function optionsWithCurrent(items, current) {
    const list = current?.id && !items.some(item => String(item.id) === String(current.id))
      ? [current, ...items] : items
    return list.map(item => ({ value: item.id, label: item.name }))
  }

  function classOptions(row) {
    const used = new Set(rows.value.filter(other => other !== row).map(other => String(other.id)))
    return optionsWithCurrent(classes.value, row).map(option => ({ ...option, disabled: used.has(String(option.value)) }))
  }

  function subclassOptions(row) {
    const parent = classes.value.find(item => String(item.id) === String(row.id)) || row
    return [
      { value: '', label: 'Без подкласса' },
      ...optionsWithCurrent(originChildren(parent, subclasses.value, 'subclasses'), row.subclass),
    ]
  }

  function changeClass(row, id) {
    if (String(row.id) === String(id)) return
    const item = classes.value.find(item => String(item.id) === String(id))
    if (!item) return
    row.id = item.id
    row.name = item.name
    row.subclass = null
  }

  function changeSubclass(row, id) {
    const option = subclassOptions(row).find(option => String(option.value) === String(id))
    if (option) row.subclass = option.value === '' ? null : { id: option.value, name: option.label }
  }

  function add() {
    rows.value.push({ key: nextKey++, id: '', name: '', level: 1, subclass: null })
  }

  function remove(row) {
    rows.value = rows.value.filter(entry => entry !== row)
  }

  function updates() {
    if (!canSave.value) return null
    return {
      classes: rows.value.map(({ id, name, level, subclass }) => ({
        id, name, level: Number(level), subclass: subclass ? { ...subclass } : null,
      })),
      lvl: { exp: 0, ...values().lvl, level: total.value },
    }
  }

  return { rows, loading, loadError, total, validation, canSave, load, classOptions, subclassOptions, changeClass, changeSubclass, add, remove, updates }
}
