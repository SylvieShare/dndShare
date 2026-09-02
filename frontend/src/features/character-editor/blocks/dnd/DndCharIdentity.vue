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

        <FormField :label="form.classes.length > 1 ? 'Классы' : 'Класс'" vertical>
          <div class="dciw-classes">
            <div v-for="(row, i) in form.classes" :key="i" class="dciw-cls-row">
              <div class="dciw-cls-main">
                <ValueSelect
                  class="dciw-cls-sel"
                  :model-value="row.classId"
                  :options="classOptions"
                  placeholder="Класс"
                  searchable
                  drop-up
                  @update:model-value="onRowClassChange(row, $event)"
                />
                <div v-if="form.classes.length > 1" class="dciw-cls-lvl">
                  <span class="dciw-cls-lvl-label">ур.</span>
                  <FormNumberInput :value="row.level" :min="1" :max="20" @change="row.level = $event" />
                </div>
                <button
                  v-if="form.classes.length > 1"
                  class="dciw-cls-x"
                  type="button"
                  title="Убрать класс"
                  @click="removeClassRow(i)"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              </div>
              <ValueSelect
                v-if="row.subclasses.length"
                :model-value="row.subclassId"
                :options="toOptions(row.subclasses)"
                placeholder="Без архетипа"
                @update:model-value="row.subclassId = $event"
              />
            </div>
            <div class="dciw-cls-foot">
              <button class="dciw-cls-add" type="button" @click="addClassRow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                Добавить класс
              </button>
              <span v-if="form.classes.length > 1" class="dciw-cls-total">Суммарный уровень: <b>{{ classLevelSum }}</b></span>
            </div>
          </div>
        </FormField>
      </div>

      <template #footer>
        <FormActionButtons submit-text="Сохранить" @cancel="close" @submit="save" />
      </template>
    </AppModalFrame>

  </div>
</template>

<script setup>
import { computed, inject, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { AppModalFrame } from '@sylvieshare/share-ui'
import { FormActionButtons } from '@sylvieshare/share-ui'
import { FormField } from '@sylvieshare/share-ui'
import { FormNumberInput } from '@sylvieshare/share-ui'
import { FormTextInput } from '@sylvieshare/share-ui'
import { ValueSelect } from '@sylvieshare/share-ui'
import { classEntriesOf, classesLabel } from '@/features/character-editor/blocks/dnd/lib/levelUp'
import { fetchGet } from '@/shared/api/http'
import { contentScopeQuery } from '@/shared/api/contentSourcesApi'

const RACE_TYPE = 8
const CLASS_TYPE = 9

const props = defineProps(['block', 'value', 'values'])
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', { ownerMode: true })

const canEdit = computed(() => charCtx.ownerMode)
const sourceSuffix = () => contentScopeQuery(charCtx.contentSources, charCtx.sourceVersionId)

const windowOpen = ref(false)
const nameInput = ref(null)

// race/class/subrace/subclass are item references `{ id, name }`.
// form.classes — multiclass rows: `{ classId, subclassId, level, subclasses }`.
const form = reactive({ name: '', raceId: '', subraceId: '', classes: [] })
const races = ref([])
const classes = ref([])
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
const classOptions    = computed(() => toOptions(classes.value))
const subraceOptions  = computed(() => toOptions(subraces.value))
const classLevelSum   = computed(() => form.classes.reduce((s, r) => s + (r.classId ? Math.max(1, parseInt(r.level) || 1) : 0), 0))

watch(() => JSON.stringify(charCtx.contentSources || {}), async () => {
  races.value = []
  classes.value = []
  subraces.value = []
  if (windowOpen.value) await ensureBaseItems()
})

async function ensureBaseItems() {
  if (!races.value.length) {
    const items = (await fetchGet(`/items?typeId=${RACE_TYPE}&limit=500${sourceSuffix()}`))?.items || []
    races.value = items.filter((i) => i.parentId == null)
  }
  if (!classes.value.length) {
    const items = (await fetchGet(`/items?typeId=${CLASS_TYPE}&limit=500${sourceSuffix()}`))?.items || []
    classes.value = items.filter((i) => i.parentId == null)
  }
}
async function loadSubraces(parentId) {
  subraces.value = parentId
    ? ((await fetchGet(`/items/children?parentId=${parentId}${sourceSuffix()}`))?.items || []).filter((i) => i.typeId === RACE_TYPE)
    : []
}
async function loadRowSubclasses(row) {
  row.subclasses = row.classId
    ? ((await fetchGet(`/items/children?parentId=${row.classId}${sourceSuffix()}`))?.items || []).filter((i) => i.typeId === CLASS_TYPE)
    : []
}

async function onRaceChange(id) {
  form.raceId = id
  form.subraceId = ''
  await loadSubraces(id)
}
async function onRowClassChange(row, id) {
  row.classId = id
  row.subclassId = ''
  await loadRowSubclasses(row)
}
function addClassRow() {
  form.classes.push({ classId: '', subclassId: '', level: 1, subclasses: [] })
}
function removeClassRow(i) {
  form.classes.splice(i, 1)
  if (!form.classes.length) addClassRow()
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
  const entries = classEntriesOf({
    classes: props.values?.[classesId.value],
    lvl: props.values?.[lvlId.value],
  })
  form.classes = entries.length
    ? entries.map((e) => ({ classId: e.id, subclassId: e.subclass?.id ?? '', level: e.level, subclasses: [] }))
    : [{ classId: '', subclassId: '', level: 1, subclasses: [] }]
  await ensureBaseItems()
  await Promise.all([
    loadSubraces(form.raceId || null),
    ...form.classes.map((row) => loadRowSubclasses(row)),
  ])
  await nextTick()
  nameInput.value?.focus?.()
})

function save() {
  emit('update:value', nameId.value, form.name)
  emit('update:value', raceId.value, resolveRef(races.value, form.raceId))
  emit('update:value', subraceId.value, resolveRef(subraces.value, form.subraceId))

  const entries = form.classes
    .filter((r) => r.classId)
    .map((r) => ({
      ...resolveRef(classes.value, r.classId),
      level: Math.max(1, Math.min(20, parseInt(r.level) || 1)),
      subclass: resolveRef(r.subclasses, r.subclassId),
    }))
    .filter((e) => e.id != null)
  emit('update:value', classesId.value, entries.length ? entries : null)
  // Мультикласс задаёт суммарный уровень листа; одиночный класс уровень не трогает —
  // им управляет блок уровня (опыт/level up).
  if (entries.length > 1) {
    const lvlVal = props.values?.[lvlId.value]
    const sum = entries.reduce((s, e) => s + e.level, 0)
    emit('update:value', lvlId.value, { exp: 0, ...(lvlVal && typeof lvlVal === 'object' ? lvlVal : {}), level: Math.min(20, sum) })
  }

  windowOpen.value = false
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

/* multiclass rows */
.dciw-classes { display: flex; flex-direction: column; gap: 10px; }
.dciw-cls-row { display: flex; flex-direction: column; gap: 6px; }
.dciw-cls-row + .dciw-cls-row { border-top: 1px dashed var(--border); padding-top: 10px; }
.dciw-cls-main { display: flex; align-items: center; gap: 8px; }
.dciw-cls-sel { flex: 1; min-width: 0; }
.dciw-cls-lvl { display: flex; align-items: center; gap: 5px; flex-shrink: 0; }
.dciw-cls-lvl :deep(input) { width: 52px; }
.dciw-cls-lvl-label { font-size: 11px; color: var(--text-muted); }
.dciw-cls-x {
  display: grid; place-items: center; width: 26px; height: 26px; flex-shrink: 0;
  border: none; border-radius: 7px; background: none; color: var(--text-muted); cursor: pointer;
}
.dciw-cls-x:hover { background: color-mix(in srgb, var(--danger) 14%, transparent); color: var(--danger); }
.dciw-cls-x svg { width: 13px; height: 13px; }
.dciw-cls-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.dciw-cls-add {
  display: inline-flex; align-items: center; gap: 6px;
  background: none; border: none; color: var(--accent);
  font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; padding: 2px 0;
}
.dciw-cls-add:hover { color: var(--text-1); }
.dciw-cls-add svg { width: 14px; height: 14px; }
.dciw-cls-total { font-size: 11px; color: var(--text-muted); }
.dciw-cls-total b { color: var(--text-2); }

</style>
