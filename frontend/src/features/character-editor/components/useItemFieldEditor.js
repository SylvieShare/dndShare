import { reactive } from 'vue'
import { useSuggestStore } from '@/stores/suggest'
import { ensureItemNames, itemName } from '@/features/handbook/objects/lib/itemNames'
import {
  cloneDefault,
  defaultDataForFields,
  getSuggestId,
  isBooleanField,
  isFieldVisible,
  numberOrNull,
} from '@/features/handbook/objects/lib/schemaFields'

export const itemFieldEditorKey = Symbol('itemFieldEditor')

const FULL_WIDTH_TYPES = new Set([
  'description', 'textarea', 'suggest_array', 'int_by_suggest', 'object', 'object_array', 'blocks',
])
const CARD_TYPES = new Set(['object', 'object_array', 'blocks'])

export function useItemFieldEditor(formData, openItemPicker) {
  const suggestStore = useSuggestStore()
  const sectionsOpen = reactive({})

  const isCardField = (field) => CARD_TYPES.has(field.type)
  const isBoolField = (field) => isBooleanField(field)
  const fieldClasses = (field) => ({
    'iem-field--full': FULL_WIDTH_TYPES.has(field.type),
    'iem-field--card': isCardField(field),
  })
  const isSectionOpen = (key) => sectionsOpen[key] !== false

  function toggleSection(key) {
    sectionsOpen[key] = !isSectionOpen(key)
  }

  function initSections(fields) {
    for (const field of fields || []) {
      if (CARD_TYPES.has(field.type) && sectionsOpen[field.key] === undefined) {
        sectionsOpen[field.key] = field.type !== 'blocks'
      }
    }
  }

  const fieldVisible = (field) => isFieldVisible(field, formData)
  const nestedFieldVisible = (parentKey, field) => isFieldVisible(field, objectValue(parentKey))
  const objectArrayFieldVisible = (_parentField, row, field) => isFieldVisible(field, row || {})
  const getSuggests = (suggestId) => suggestStore.items(suggestId) || []
  const getSuggestLabel = (suggestId, id) => (
    getSuggests(suggestId).find((entry) => entry.id === id)?.value || String(id)
  )
  const itemRefLabel = (id) => (id == null ? 'Выбрать предмет' : itemName(id) || `#${id}`)

  function intBySuggestValue(key) {
    const current = formData[key]
    if (current && typeof current === 'object' && !Array.isArray(current)) return current
    formData[key] = typeof current === 'number'
      ? { value: current, suggest_id: null }
      : { value: null, suggest_id: null }
    return formData[key]
  }

  function setIntBySuggestField(key, subKey, value) {
    formData[key] = { ...intBySuggestValue(key), [subKey]: value }
  }

  function collectItemRefIds(fields, data) {
    const ids = []
    for (const field of fields || []) {
      const value = data?.[field.key]
      if (field.type === 'item' && value != null) ids.push(value)
      else if (field.type === 'object' && value) ids.push(...collectItemRefIds(field.fields, value))
      else if (field.type === 'object_array' && Array.isArray(value)) {
        for (const row of value) ids.push(...collectItemRefIds(field.fields, row))
      }
    }
    return ids
  }

  function availableSuggests(field) {
    const selected = formData[field.key] || []
    return getSuggests(getSuggestId(field)).filter((entry) => !selected.includes(entry.id))
  }

  function availableNestedSuggests(parentKey, field) {
    const selected = objectValue(parentKey)[field.key] || []
    return getSuggests(getSuggestId(field)).filter((entry) => !selected.includes(entry.id))
  }

  function addArrayVal(key, event) {
    const id = numberOrNull(event.target.value)
    event.target.value = ''
    if (id != null && !(formData[key] || []).includes(id)) {
      formData[key] = [...(formData[key] || []), id]
    }
  }

  function removeArrayVal(key, id) {
    formData[key] = (formData[key] || []).filter((value) => value !== id)
  }

  function addNestedArrayVal(parentKey, subKey, event) {
    const id = numberOrNull(event.target.value)
    event.target.value = ''
    if (id == null) return
    const current = objectValue(parentKey)[subKey] || []
    if (!current.includes(id)) setObjectField(parentKey, subKey, [...current, id])
  }

  function removeNestedArrayVal(parentKey, subKey, id) {
    const current = objectValue(parentKey)[subKey] || []
    setObjectField(parentKey, subKey, current.filter((value) => value !== id))
  }

  function ensureContainerFields(fields) {
    for (const field of fields || []) {
      if (field.type === 'object' && !formData[field.key]) {
        formData[field.key] = defaultDataForObject(field)
      } else if (field.type === 'object_array' && !Array.isArray(formData[field.key])) {
        formData[field.key] = []
      } else if (field.type === 'suggest_array' && !Array.isArray(formData[field.key])) {
        formData[field.key] = []
      }
    }
  }

  function defaultDataForObject(field) {
    const data = defaultDataForFields(field.fields || [])
    for (const subField of field.fields || []) {
      if (subField.type === 'object' && !data[subField.key]) data[subField.key] = defaultDataForObject(subField)
      if (subField.type === 'object_array' && !Array.isArray(data[subField.key])) data[subField.key] = []
      if (subField.type === 'suggest_array' && !Array.isArray(data[subField.key])) data[subField.key] = []
    }
    return data
  }

  function objectValue(key) {
    if (!formData[key] || typeof formData[key] !== 'object' || Array.isArray(formData[key])) {
      formData[key] = {}
    }
    return formData[key]
  }

  function setObjectField(objectKey, fieldKey, value) {
    formData[objectKey] = { ...objectValue(objectKey), [fieldKey]: value }
  }

  function nestedObjectArrayValue(objectKey, arrayKey) {
    const object = objectValue(objectKey)
    if (!Array.isArray(object[arrayKey])) setObjectField(objectKey, arrayKey, [])
    return formData[objectKey][arrayKey]
  }

  function objectArrayValue(key) {
    if (!Array.isArray(formData[key])) formData[key] = []
    return formData[key]
  }

  function emptyObjectArrayRow(field) {
    const row = {}
    for (const subField of field.fields || []) {
      if (Object.prototype.hasOwnProperty.call(subField, 'default')) row[subField.key] = cloneDefault(subField.default)
      else if (isBooleanField(subField)) row[subField.key] = false
      else if (['int', 'float', 'suggest', 'item', 'dice'].includes(subField.type)) row[subField.key] = null
      else if (['suggest_array', 'text_array', 'object_array'].includes(subField.type)) row[subField.key] = []
      else if (subField.type === 'object') row[subField.key] = defaultDataForObject(subField)
      else row[subField.key] = ''
    }
    return row
  }

  const addObjectArrayRow = (field) => {
    formData[field.key] = [...objectArrayValue(field.key), emptyObjectArrayRow(field)]
  }
  const removeObjectArrayRow = (key, rowIndex) => {
    formData[key] = objectArrayValue(key).filter((_, index) => index !== rowIndex)
  }
  const setObjectArrayField = (key, rowIndex, fieldKey, value) => {
    formData[key] = objectArrayValue(key).map((row, index) => (
      index === rowIndex ? { ...row, [fieldKey]: value } : row
    ))
  }
  const rowObjectArrayValue = (key, rowIndex, subKey) => {
    const row = objectArrayValue(key)[rowIndex] || {}
    return Array.isArray(row[subKey]) ? row[subKey] : []
  }
  const addRowObjectArrayRow = (key, rowIndex, field) => {
    const rows = rowObjectArrayValue(key, rowIndex, field.key)
    setObjectArrayField(key, rowIndex, field.key, [...rows, emptyObjectArrayRow(field)])
  }
  const removeRowObjectArrayRow = (key, rowIndex, subKey, nestedIndex) => {
    const rows = rowObjectArrayValue(key, rowIndex, subKey).filter((_, index) => index !== nestedIndex)
    setObjectArrayField(key, rowIndex, subKey, rows)
  }
  const setRowObjectArrayField = (key, rowIndex, subKey, nestedIndex, nestedKey, value) => {
    const rows = rowObjectArrayValue(key, rowIndex, subKey).map((row, index) => (
      index === nestedIndex ? { ...row, [nestedKey]: value } : row
    ))
    setObjectArrayField(key, rowIndex, subKey, rows)
  }
  const addNestedObjectArrayRow = (objectKey, field) => {
    setObjectField(objectKey, field.key, [
      ...nestedObjectArrayValue(objectKey, field.key), emptyObjectArrayRow(field),
    ])
  }
  const removeNestedObjectArrayRow = (objectKey, arrayKey, rowIndex) => {
    const rows = nestedObjectArrayValue(objectKey, arrayKey).filter((_, index) => index !== rowIndex)
    setObjectField(objectKey, arrayKey, rows)
  }
  const setNestedObjectArrayField = (objectKey, arrayKey, rowIndex, fieldKey, value) => {
    const rows = nestedObjectArrayValue(objectKey, arrayKey).map((row, index) => (
      index === rowIndex ? { ...row, [fieldKey]: value } : row
    ))
    setObjectField(objectKey, arrayKey, rows)
  }

  function blocksValue(key) {
    if (!Array.isArray(formData[key])) formData[key] = []
    return formData[key]
  }
  const addBlock = (key) => { formData[key] = [...blocksValue(key), { name: '', value: '' }] }
  const removeBlock = (key, index) => { formData[key] = blocksValue(key).filter((_, i) => i !== index) }
  const setBlockField = (key, index, fieldKey, value) => {
    formData[key] = blocksValue(key).map((block, i) => i === index ? { ...block, [fieldKey]: value } : block)
  }
  function moveBlock(key, index, delta) {
    const blocks = [...blocksValue(key)]
    const target = index + delta
    if (target < 0 || target >= blocks.length) return
    const [item] = blocks.splice(index, 1)
    blocks.splice(target, 0, item)
    formData[key] = blocks
  }

  return {
    formData,
    getSuggestId,
    numberOrNull,
    isCardField,
    isBoolField,
    fieldClasses,
    isSectionOpen,
    toggleSection,
    initSections,
    isFieldVisible: fieldVisible,
    isNestedFieldVisible: nestedFieldVisible,
    isObjectArrayFieldVisible: objectArrayFieldVisible,
    intBySuggestValue,
    setIntBySuggestField,
    getSuggests,
    getSuggestLabel,
    itemRefLabel,
    openItemPicker,
    collectItemRefIds,
    availableSuggests,
    availableNestedSuggests,
    addArrayVal,
    removeArrayVal,
    addNestedArrayVal,
    removeNestedArrayVal,
    ensureContainerFields,
    objectValue,
    setObjectField,
    nestedObjectArrayValue,
    objectArrayValue,
    addObjectArrayRow,
    removeObjectArrayRow,
    setObjectArrayField,
    rowObjectArrayValue,
    addRowObjectArrayRow,
    removeRowObjectArrayRow,
    setRowObjectArrayField,
    addNestedObjectArrayRow,
    removeNestedObjectArrayRow,
    setNestedObjectArrayField,
    blocksValue,
    addBlock,
    removeBlock,
    setBlockField,
    moveBlock,
    ensureItemNames,
  }
}
