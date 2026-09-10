<template>
  <div class="session-entity-form">
    <div class="session-entity-form-fields">
      <SessionEditableField
        v-for="field in visibleFields"
        :key="field.key"
        :model-value="draft[field.key]"
        :label="field.label"
        :icon="field.icon"
        :display-value="displayValue(field)"
        :editable="editable"
        :force-open="editing"
        :multiline="!!field.multiline"
        :rows="field.rows || 4"
        :maxlength="field.maxlength || 0"
        :required="!!field.required"
        :wide="!!field.wide"
        :saving="saving || busy || uploading"
        :persist="value => saveField(field.key, value)"
        @update:model-value="updateField(field.key, $event)"
      >
        <template v-if="field.key === 'name' && type === 'npc' && editing" #actions>
          <button type="button" class="session-entity-random-name" aria-label="Случайное имя" @click="draft.name = randomDndName(selectedRace, Math.random, draft.name)"><Dices :size="16" /></button>
        </template>
        <template v-if="field.input !== 'text'" #editor="{ value, update }">
          <FormSelect v-if="field.input === 'select' || field.input === 'race'" :value="value" :disabled="saving || busy || (field.input === 'race' && racesLoading)" @update:value="update($event)">
            <option v-if="field.input === 'race'" value="">Не выбрана</option>
            <option v-for="option in field.input === 'race' ? raceOptions : field.options" :key="option.key" :value="option.key">{{ option.label }}</option>
          </FormSelect>
          <ColorPresetPicker v-else-if="field.input === 'color'" inline allow-custom :model-value="value" @update:model-value="update($event || '#7c5cff')" />
          <SessionEntityAssetInput
            v-else-if="field.input === 'image' || field.input === 'video'"
            :model-value="value"
            :catalog="field.catalog || 'story'"
            :video="field.input === 'video'"
            :allow-upload="!!field.allowUpload"
            @update:model-value="update"
            @busy="uploading = $event"
          />
          <div v-else-if="field.input === 'bestiary'" class="session-entity-reference-input">
            <AddButton :label="value ? 'Сменить существо' : 'Выбрать существо'" @click="openBestiary(update)" />
            <RemoveButton v-if="value" icon="trash" label="Убрать привязку к бестиарию" @click="update('')" />
            <span>{{ referenceNames[value] || (Number(value) === Number(entity?.bestiaryItemId) ? entity?.bestiaryItemName : '') || (value ? `Существо #${value}` : 'Не выбрано') }}</span>
          </div>
        </template>
        <template v-if="type === 'material' && ['content', 'asset'].includes(field.key)" #display>
          <SessionMaterialPreview :material="entity" />
        </template>
        <template v-else-if="field.input === 'image'" #display>
          <img v-if="draft[field.key].url" class="session-entity-form-image" :src="draft[field.key].url" :alt="field.label" :style="{ objectPosition: `${(draft[field.key].focalX ?? .5) * 100}% ${(draft[field.key].focalY ?? .5) * 100}%` }" />
          <p v-else>{{ draft[field.key].id ? 'Изображение выбрано' : 'Не выбрано' }}</p>
        </template>
        <template v-else-if="field.input === 'color'" #display><span class="session-entity-color-value"><i :style="{ background: draft.color }" />{{ draft.color }}</span></template>
      </SessionEditableField>
    </div>
    <UniversalRelationList
      :relations="draft.relations"
      :items="relationItems"
      :source-type="type"
      :source-id="entity?.id"
      :editable="editable"
      :force-open="editing"
      :saving="saving || busy"
      :persist="changeRelations"
      @open="$emit('open-entity', $event)"
    />
    <p v-if="error || racesError" class="session-entity-form-error" role="alert">{{ error || racesError }}</p>
    <FormActionButtons
      v-if="editing"
      :submit-text="entity ? 'Сохранить' : 'Создать'"
      :loading="saving || busy || uploading"
      :can-submit="entityDraftValid(type, draft)"
      @cancel="$emit('cancel')"
      @submit="submit"
    />
    <ItemPickerModal v-if="bestiaryUpdate" :item-type-ids="[6]" title="Привязать существо из бестиария" :z-index="9200" @close="bestiaryUpdate = null" @pick="pickBestiary" />
  </div>
</template>
<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Dices } from '@lucide/vue'
import { AddButton, ColorPresetPicker, FormActionButtons, FormSelect, RemoveButton } from '@sylvieshare/share-ui'
import ItemPickerModal from '@/features/handbook/components/ItemPickerModal.vue'
import SessionEditableField from './SessionEditableField.vue'
import SessionMaterialPreview from './SessionMaterialPreview.vue'
import SessionEntityAssetInput from './SessionEntityAssetInput.vue'
import UniversalRelationList from './UniversalRelationList.vue'
import { entityDraft, entityDraftValid, entityFields, entityPayload } from '../lib/sessionEntityForm'
import { itemsApi } from '@/shared/api/itemsApi'
import { randomDndName } from '@/shared/lib/dndNames'
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
const fields = computed(() => entityFields(props.type, draft, props.entity, props.locations))
const visibleFields = computed(() => fields.value.filter(field => props.editing || field.key !== 'name'))
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
  if (field.input === 'race') return raceOptions.value.find(item => Number(item.key) === Number(value))?.label || 'Не выбрана'
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
</script>
<style scoped>
.session-entity-form { display: flex; flex-direction: column; gap: 22px; min-width: 0; }
.session-entity-form-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.session-entity-form-image { width: 100%; max-height: 220px; object-fit: cover; border-radius: 8px; }
.session-entity-color-value, .session-entity-reference-input { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.session-entity-color-value i { width: 22px; height: 22px; border-radius: 50%; border: 1px solid var(--border); }
.session-entity-form-error { color: var(--danger); }
.session-entity-random-name { display: grid; place-items: center; padding: 5px; border: 0; background: transparent; color: var(--accent); cursor: pointer; }
@media (max-width: 720px) { .session-entity-form-fields { grid-template-columns: 1fr; } }
</style>
