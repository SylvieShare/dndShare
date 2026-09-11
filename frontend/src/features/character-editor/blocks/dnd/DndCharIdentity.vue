<template>
  <div class="dci-wrap">
    <div class="dci-main-row">
      <span class="dci-name" :style="nameStyle">{{ nameVal || 'Имя персонажа' }}</span>
      <template v-if="racePart">
        <span class="dci-sep">·</span>
        <span class="dci-sub">{{ racePart }}</span>
      </template>
      <button
        v-if="canEdit"
        class="dci-edit"
        type="button"
        title="Редактировать"
        @click.stop="openWindow"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>
    </div>
    <div v-if="classParts.length" class="dci-classes" :title="classPart">
      <span v-for="(part, index) in classParts" :key="index" class="dci-class-item">
        <span class="dci-class-label">{{ part }}</span>
        <span v-if="index < classParts.length - 1" class="dci-class-sep" aria-hidden="true">·</span>
      </span>
    </div>

    <AppModalFrame v-if="windowOpen" title="Персонаж" @close="close">
      <div class="dciw-body">
        <FormField label="Имя" vertical>
          <FormTextInput
            ref="nameInput"
            v-model:value="form.name"
            placeholder="Имя персонажа"
            @enter="save"
            @keydown.escape="close"
          />
        </FormField>

        <FormField label="Раса" vertical>
          <ValueSelect
            :model-value="form.raceId"
            :options="raceOptions"
            placeholder="Раса"
            searchable
            @update:model-value="onRaceChange"
          />
        </FormField>

        <FormField v-if="subraces.length" label="Происхождение" vertical>
          <ValueSelect
            :model-value="form.subraceId"
            :options="subraceOptions"
            placeholder="Без происхождения"
            @update:model-value="form.subraceId = $event"
          />
        </FormField>

        <FormField label="Классы" vertical>
          <DndClassList :entries="classEntries" />
          <ActionButton variant="secondary" @click="manualClassesOpen = true">Редактировать классы</ActionButton>
        </FormField>
      </div>

      <template #footer>
        <FormActionButtons submit-text="Сохранить" @cancel="close" @submit="save" />
      </template>
    </AppModalFrame>

    <DndClassesEditorModal
      v-if="manualClassesOpen"
      :values="{ classes: values?.[classesId], lvl: values?.[lvlId] }"
      @apply="applyClasses"
      @close="manualClassesOpen = false"
    />
  </div>
</template>

<script setup>
import { ActionButton, AppModalFrame, FormActionButtons, FormField, FormTextInput, ValueSelect } from '@sylvieshare/share-ui'
import DndClassList from './components/DndClassList.vue'
import DndClassesEditorModal from './components/DndClassesEditorModal.vue'
import { computed, inject, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { classEntriesOf, classesLabel } from '@/features/character-editor/blocks/dnd/lib/levelUp'
import { fetchGet } from '@/shared/api/http'
import { contentScopeQuery } from '@/shared/api/contentSourcesApi'
import {
  RACE_ITEM_TYPE,
  SUBRACE_ITEM_TYPE,
  originFilterQuery,
} from '@/shared/lib/dndItemTypes'

const props = defineProps(['block', 'value', 'values'])
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', { ownerMode: true })

const canEdit = computed(() => charCtx.ownerMode)
const sourceSuffix = () => contentScopeQuery(charCtx.contentSources, charCtx.sourceVersionId)

const windowOpen = ref(false)
const nameInput = ref(null)
const manualClassesOpen = ref(false)

// race/class/subrace/subclass are item references `{ id, name }`.
const form = reactive({ name: '', raceId: '', subraceId: '' })
const races = ref([])
const subraces = ref([])

const nameId     = computed(() => props.block.content?.name_id     || 'name')
const raceId     = computed(() => props.block.content?.race_id     || 'race')
const subraceId  = computed(() => props.block.content?.subrace_id  || 'subrace')
const classesId  = computed(() => props.block.content?.classes_id  || 'classes')
const lvlId      = computed(() => props.block.content?.lvl_id      || 'lvl')

function nameOf(v) {
  return v && typeof v === 'object' ? (v.name ?? '') : ''
}
function refId(v) {
  return v && typeof v === 'object' ? (v.id ?? '') : ''
}
function resolveRef(list, id) {
  const it = list.find((x) => String(x.id) === String(id))
  return it ? { id: it.id, name: it.name } : null
}
function toOptions(list) {
  return list.map((it) => ({ value: it.id, label: it.name }))
}

const nameVal     = computed(() => String(props.values?.[nameId.value] || ''))
const raceVal     = computed(() => nameOf(props.values?.[raceId.value]))
const subraceVal  = computed(() => nameOf(props.values?.[subraceId.value]))

const racePart  = computed(() => subraceVal.value || raceVal.value)
const classEntries = computed(() => classEntriesOf({
  classes: props.values?.[classesId.value],
  lvl: props.values?.[lvlId.value],
}))
const classParts = computed(() => classEntries.value.map((entry) => classesLabel([entry])))
const classPart = computed(() => classesLabel(classEntries.value))

const nameColor = computed(() => props.block.content?.name_color || 'var(--text-1)')
const nameStyle = computed(() => ({ color: nameColor.value }))

const raceOptions     = computed(() => toOptions(races.value))
const subraceOptions  = computed(() => toOptions(subraces.value))

watch(() => JSON.stringify(charCtx.contentSources || {}), async () => {
  races.value = []
  subraces.value = []
  if (windowOpen.value) await ensureBaseItems()
})

async function ensureBaseItems() {
  if (!races.value.length) {
    races.value = (await fetchGet(`/items?typeId=${RACE_ITEM_TYPE}&limit=500${sourceSuffix()}`))?.items || []
  }
}
async function loadSubraces(parentId) {
  subraces.value = parentId
    ? (await fetchGet(`/items?typeId=${SUBRACE_ITEM_TYPE}&limit=500${originFilterQuery('race', parentId)}${sourceSuffix()}`))?.items || []
    : []
}
async function onRaceChange(id) {
  form.raceId = id
  form.subraceId = ''
  await loadSubraces(id)
}
function openWindow() {
  windowOpen.value = true
}

function onIdentityEditRequest() {
  if (canEdit.value) openWindow()
}

onMounted(() => window.addEventListener('dndshare:edit-character-identity', onIdentityEditRequest))
onBeforeUnmount(() => {
  window.removeEventListener('dndshare:edit-character-identity', onIdentityEditRequest)
})

watch(windowOpen, async (open) => {
  if (!open) return
  form.name       = nameVal.value
  form.raceId     = refId(props.values?.[raceId.value])
  form.subraceId  = refId(props.values?.[subraceId.value])
  await ensureBaseItems()
  await loadSubraces(form.raceId || null)
  await nextTick()
  nameInput.value?.focus?.()
})

function save() {
  emit('update:value', nameId.value, form.name)
  emit('update:value', raceId.value, resolveRef(races.value, form.raceId))
  emit('update:value', subraceId.value, resolveRef(subraces.value, form.subraceId))

  windowOpen.value = false
}

function applyClasses(updates) {
  emit('update:value', classesId.value, updates.classes)
  emit('update:value', lvlId.value, updates.lvl)
  manualClassesOpen.value = false
}

function close() {
  windowOpen.value = false
}
</script>

<style scoped>
.dci-wrap {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
}

.dci-main-row {
  display: flex;
  align-items: baseline;
  width: 100%;
  min-width: 0;
  overflow: hidden;
}

.dci-name {
  font-size: 26px;
  font-weight: 600;
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 0 1 auto;
  min-width: 0;
}

.dci-sep {
  font-size: 14px;
  color: var(--text-muted);
  margin: 0 6px;
  line-height: 1;
  align-self: center;
  flex: 0 0 auto;
}

.dci-sub {
  font-size: 14px;
  color: var(--text-2);
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 0 1 auto;
  min-width: 0;
}

.dci-classes {
  display: flex;
  flex-wrap: wrap;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  color: var(--text-2);
  font-size: 14px;
  line-height: 1.1;
}

.dci-class-item {
  display: inline-flex;
  max-width: 100%;
  min-width: 0;
  white-space: nowrap;
}

.dci-class-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dci-class-sep {
  flex: 0 0 auto;
  margin: 0 6px;
}

.dci-edit {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  margin-left: 6px;
  align-self: center;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0.35;
  transition: color 0.15s, opacity 0.15s;
}
@media (hover: hover) { .dci-edit:hover { color: var(--accent); opacity: 1; } }
.dci-edit:focus-visible { color: var(--accent); opacity: 1; }

.dciw-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

</style>
