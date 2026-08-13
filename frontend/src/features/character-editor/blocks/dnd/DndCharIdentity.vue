<template>
  <div class="dci-wrap">
    <span class="dci-name" :style="nameStyle">{{ nameVal || 'Имя персонажа' }}</span>
    <template v-if="racePart || classPart">
      <span class="dci-sep">·</span>
      <span class="dci-sub">{{ subline }}</span>
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

    <AppModalFrame v-if="windowOpen" title="Персонаж" @close="close">
      <div class="dciw-body">
        <FormField label="Аватар" vertical>
          <div
            class="dciw-ava"
            :class="{ 'dciw-ava--drag': avaDragging, 'dciw-ava--empty': !avaUrl }"
            @click="avaInput?.click()"
            @dragover.prevent="avaDragging = true"
            @dragleave.prevent="avaDragging = false"
            @drop.prevent="onAvaDrop"
          >
            <img v-if="avaUrl" :src="avaUrl" class="dciw-ava-img" alt="avatar" />
            <span v-else-if="avaUploading" class="dciw-ava-spinner"></span>
            <span v-else class="dciw-ava-hint">Фото</span>
            <div v-if="avaUrl" class="dciw-ava-overlay">Изменить</div>
            <input ref="avaInput" type="file" accept="image/*" style="display:none" @change="onAvaChange" />
          </div>
          <span v-if="avaError" class="dciw-error">{{ avaError }}</span>
        </FormField>

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
import AppModalFrame from '@/shared/ui/AppModalFrame.vue'
import FormActionButtons from '@/shared/ui/form/FormActionButtons'
import FormField from '@/shared/ui/form/FormField'
import FormNumberInput from '@/shared/ui/form/FormNumberInput'
import FormTextInput from '@/shared/ui/form/FormTextInput'
import ValueSelect from '@/shared/ui/ValueSelect'
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

// ─── avatar (own block, edited here too) ───────────────────────────────────
const avaInput = ref(null)
const avaDragging = ref(false)
const avaUploading = ref(false)
const avaValue = ref(null)
const avaError = ref('')
const avaUrl = computed(() => {
  const v = avaValue.value
  if (!v) return null
  return v.url || null
})

const nameId     = computed(() => props.block.content?.name_id     || 'name')
const raceId     = computed(() => props.block.content?.race_id     || 'race')
const subraceId  = computed(() => props.block.content?.subrace_id  || 'subrace')
const classesId  = computed(() => props.block.content?.classes_id  || 'classes')
const lvlId      = computed(() => props.block.content?.lvl_id      || 'lvl')
const avatarId   = computed(() => props.block.content?.avatar_id   || 'ava')

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
const classPart = computed(() => classesLabel(classEntriesOf({
  classes: props.values?.[classesId.value],
  lvl: props.values?.[lvlId.value],
})))
const subline = computed(() => [racePart.value, classPart.value].filter(Boolean).join(' · '))

const nameColor = computed(() => props.block.content?.name_color || 'var(--text-on-accent)')
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
onBeforeUnmount(() => window.removeEventListener('dndshare:edit-character-identity', onIdentityEditRequest))

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
  avaValue.value  = props.values?.[avatarId.value] ?? null
  avaDragging.value = false
  avaError.value = ''
  await ensureBaseItems()
  await Promise.all([
    loadSubraces(form.raceId || null),
    ...form.classes.map((row) => loadRowSubclasses(row)),
  ])
  await nextTick()
  nameInput.value?.focus?.()
})

// ─── avatar upload ─────────────────────────────────────────────────────────
function onAvaDrop(e) {
  avaDragging.value = false
  const file = e.dataTransfer.files[0]
  if (file && file.type.startsWith('image/')) uploadAva(file)
}
function onAvaChange(e) {
  const file = e.target.files[0]
  if (file) uploadAva(file)
  e.target.value = ''
}
async function uploadAva(file) {
  avaError.value = ''
  if (file.size > 8 * 1024 * 1024) {
    avaError.value = 'Файл слишком большой (максимум 8 МБ)'
    return
  }
  avaUploading.value = true
  const prev = avaValue.value
  avaValue.value = null
  try {
    const formData = new FormData()
    formData.append('file', file)
    if (prev?.upload_id) formData.append('old_upload_id', prev.upload_id)
    const res = await fetch('/api/storage/images', { method: 'POST', body: formData })
    if (!res.ok) throw new Error(res.status)
    const data = await res.json()
    avaValue.value = { url: data.url, upload_id: data.upload_id }
  } catch {
    avaValue.value = prev
    avaError.value = 'Не удалось загрузить изображение'
  } finally {
    avaUploading.value = false
  }
}

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

  emit('update:value', avatarId.value, avaValue.value)
  windowOpen.value = false
}

function close() {
  windowOpen.value = false
}
</script>

<style scoped>
.dci-wrap {
  display: flex;
  align-items: baseline;
  flex-wrap: nowrap;
  gap: 0;
  min-width: 0;
  overflow: hidden;
}

.dciw-error {
  color: var(--danger);
  font-size: 12px;
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
  opacity: 0.55;
  transition: opacity 0.15s;
}
@media (hover: hover) { .dci-edit:hover { opacity: 1; } }

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

/* avatar uploader */
.dciw-ava {
  position: relative;
  width: 96px;
  height: 96px;
  border-radius: 14px;
  overflow: hidden;
  cursor: pointer;
  background-color: color-mix(in srgb, var(--accent) 18%, var(--surface));
  display: grid;
  place-items: center;
  transition: box-shadow 0.2s ease;
}
.dciw-ava--empty { border: 1px dashed var(--border-strong); }
@media (hover: hover) { .dciw-ava:hover { box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 50%, transparent); } }
.dciw-ava--drag { box-shadow: 0 0 0 2px var(--accent), 0 0 20px color-mix(in srgb, var(--accent) 40%, transparent); }

.dciw-ava-img { width: 100%; height: 100%; object-fit: cover; object-position: top center; display: block; }
.dciw-ava-hint { font-size: 12px; letter-spacing: 0.04em; color: color-mix(in srgb, var(--accent) 60%, transparent); }
.dciw-ava-overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--scrim) 81%, transparent);
  color: color-mix(in srgb, var(--text-on-accent) 85%, transparent);
  font-size: 12px;
  opacity: 0;
  transition: opacity 0.18s ease;
}
@media (hover: hover) { .dciw-ava:hover .dciw-ava-overlay { opacity: 1; } }
.dciw-ava-spinner {
  width: 26px;
  height: 26px;
  border: 3px solid color-mix(in srgb, var(--accent) 25%, transparent);
  border-top-color: color-mix(in srgb, var(--accent) 75%, transparent);
  border-radius: 50%;
  animation: dciw-spin 0.8s linear infinite;
}
@keyframes dciw-spin { to { transform: rotate(360deg); } }
</style>
