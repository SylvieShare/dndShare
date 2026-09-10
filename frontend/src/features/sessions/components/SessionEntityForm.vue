<template>
  <slot>
    <div class="session-entity-form">
      <header class="session-entity-form-header"><SessionEntityFormVisual /><SessionEntityFormHeader /></header>
      <SessionEntityFormBody />
    </div>
  </slot>
  <ItemPickerModal v-if="bestiaryUpdate" :item-type-ids="[6]" title="Привязать существо из бестиария" :z-index="9200" @close="bestiaryUpdate = null" @pick="pickBestiary" />
</template>
<script setup>
import { computed, onMounted, provide, reactive, ref, watch } from 'vue'
import ItemPickerModal from '@/features/handbook/components/ItemPickerModal.vue'
import SessionEntityFormHeader from './SessionEntityFormHeader.vue'
import SessionEntityFormVisual from './SessionEntityFormVisual.vue'
import SessionEntityFormBody from './SessionEntityFormBody.vue'
import { SESSION_ENTITY_FORM } from '../lib/sessionEntityFormContext'
import { entityDraft, entityDraftValid, entityFields, entityPayload } from '../lib/sessionEntityForm'
import { itemsApi } from '@/shared/api/itemsApi'
import { RACE_ITEM_TYPE, SUBRACE_ITEM_TYPE, itemReferenceId } from '@/shared/lib/dndItemTypes'

const props = defineProps({
  type: { type: String, required: true },
  entity: { type: Object, default: null },
  editing: Boolean,
  editable: Boolean,
  saving: Boolean,
  save: { type: Function, required: true },
  locations: { type: Array, default: () => [] },
  relationItems: { type: Array, default: () => [] },
  defaults: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['cancel', 'saved', 'open-entity', 'edit-request'])
const draft = reactive(entityDraft(props.type, props.entity, props.defaults))
const busy = ref(false)
const uploading = ref(false)
const error = ref('')
const races = ref([])
const racesLoading = ref(false)
const racesError = ref('')
const referenceNames = reactive({})
const bestiaryUpdate = ref(null)
let pendingKind = null
const fields = computed(() => entityFields(props.type, draft))
const headerKeys = computed(() => ({ location: ['kind', 'name'], npc: ['name', 'raceItemId', 'role', 'color'], quest: ['status', 'name'], material: ['kind', 'name', 'noteStyle'] }[props.type] || ['name']))
const headerFields = computed(() => headerKeys.value.map(key => fields.value.find(field => field.key === key)).filter(Boolean))
const visualField = computed(() => fields.value.find(field => ['image', 'asset'].includes(field.key)))
const bodyFields = computed(() => fields.value.filter(field => !headerKeys.value.includes(field.key) && !['image', 'asset'].includes(field.key)))
const selectedRace = computed(() => races.value.find(race => Number(race.id) === Number(draft.raceItemId)) || (draft.raceItemId && Number(draft.raceItemId) === Number(props.entity?.raceItemId) && props.entity?.raceName ? { name: props.entity.raceName } : null))
const raceOptions = computed(() => {
  const byId = new Map(races.value.map(race => [race.id, race]))
  const options = races.value.map(race => ({ key: race.id, label: byId.get(itemReferenceId(race.data?.race)) ? `${byId.get(itemReferenceId(race.data?.race)).name} — ${race.name}` : race.name }))
  if (props.entity?.raceItemId && !byId.has(props.entity.raceItemId)) options.push({ key: props.entity.raceItemId, label: props.entity.raceName || `Раса #${props.entity.raceItemId}` })
  return options.sort((a, b) => a.label.localeCompare(b.label, 'ru'))
})
watch(() => props.entity, entity => {
  if (!props.editing) Object.assign(draft, entityDraft(props.type, entity, props.defaults))
})
watch(() => props.editing, () => {
  Object.assign(draft, entityDraft(props.type, props.entity, props.defaults))
  if (props.editing && pendingKind) updateField('kind', pendingKind)
  pendingKind = null
  error.value = ''
})
onMounted(async () => {
  if (props.type !== 'npc' || !props.editable) return
  racesLoading.value = true
  try {
    const [base, variants] = await Promise.all([itemsApi.list(RACE_ITEM_TYPE, 500), itemsApi.list(SUBRACE_ITEM_TYPE, 500)])
    races.value = [...(base?.items || []), ...(variants?.items || [])]
  } catch { racesError.value = 'Не удалось загрузить расы' }
  finally { racesLoading.value = false }
})
function displayValue(field) {
  const value = draft[field.key]
  if (field.input === 'race') return raceOptions.value.find(item => Number(item.key) === Number(value))?.label || 'Раса не выбрана'
  if (field.input === 'bestiary') return value ? referenceNames[value] || props.entity?.bestiaryItemName || `Существо #${value}` : 'Не привязан'
  if (field.options) return field.options.find(item => String(item.key) === String(value))?.label || 'Не выбрано'
  if (field.input === 'video') return value.id ? 'Видеофайл выбран' : 'Не выбран'
  return undefined
}
function updateField(key, value) {
  if (key === 'kind' && props.type === 'material' && !(['image', 'map'].includes(draft.kind) && ['image', 'map'].includes(value))) draft.asset = { id: 0, url: '' }
  draft[key] = value
}
async function persist(next) {
  if (!props.editable || props.saving || busy.value || uploading.value) return false
  if (!entityDraftValid(props.type, next)) throw new Error('Заполните название и обязательное содержимое или изображение')
  busy.value = true; error.value = ''
  try { return await props.save(entityPayload(props.type, next)) !== false }
  finally { busy.value = false }
}
async function saveField(key, value) {
  // Each pencil saves against current server data, so other fields are preserved.
  const next = entityDraft(props.type, props.entity, props.defaults)
  next[key] = value
  if (key === 'kind' && props.type === 'material' && value !== draft.kind) {
    // A type change may require a new file or text; finish it in the full form.
    pendingKind = value
    emit('edit-request')
    return false
  }
  const saved = await persist(next)
  if (saved) draft[key] = value
  return saved
}
async function changeRelations(relations) {
  if (props.editing) { draft.relations = relations; return true }
  return saveField('relations', relations)
}
async function submit() {
  try { if (await persist(draft)) emit('saved') }
  catch (cause) { error.value = cause.message || 'Не удалось сохранить объект' }
}
function openBestiary(update) { bestiaryUpdate.value = update }
function pickBestiary(item) {
  referenceNames[item.id] = item.name
  bestiaryUpdate.value?.(item.id)
  bestiaryUpdate.value = null
}

provide(SESSION_ENTITY_FORM, {
  props, draft, busy, uploading, error, racesError, headerFields, bodyFields, visualField,
  raceOptions, racesLoading, referenceNames, selectedRace, displayValue, saveField, updateField,
  openBestiary, changeRelations, submit,
  openEntity: item => emit('open-entity', item), cancel: () => emit('cancel'),
})
</script>
<style scoped>
.session-entity-form { display: flex; flex-direction: column; gap: 22px; min-width: 0; }
.session-entity-form-header { display: flex; align-items: flex-start; gap: 18px; }
</style>
