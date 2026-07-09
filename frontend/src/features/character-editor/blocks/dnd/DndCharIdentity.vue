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

    <AppModal v-if="windowOpen" tile @close="close">
      <div class="dciw-title">Персонаж</div>

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

        <FormField label="Класс" vertical>
          <ValueSelect
            :model-value="form.classId"
            :options="classOptions"
            placeholder="Класс"
            searchable
            @update:model-value="onClassChange"
          />
        </FormField>

        <FormField v-if="subclasses.length" label="Архетип" vertical>
          <ValueSelect
            :model-value="form.subclassId"
            :options="subclassOptions"
            placeholder="Без архетипа"
            @update:model-value="form.subclassId = $event"
          />
        </FormField>
      </div>

      <FormActionButtons submit-text="Сохранить" @cancel="close" @submit="save" />
    </AppModal>
  </div>
</template>

<script setup>
import { computed, inject, nextTick, reactive, ref, watch } from 'vue'
import AppModal from '@/shared/ui/AppModal'
import FormActionButtons from '@/shared/ui/form/FormActionButtons'
import FormField from '@/shared/ui/form/FormField'
import FormTextInput from '@/shared/ui/form/FormTextInput'
import ValueSelect from '@/shared/ui/ValueSelect'
import { fetchGet } from '@/shared/api/http'

const RACE_TYPE = 8
const CLASS_TYPE = 9

const props = defineProps(['block', 'value', 'values'])
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', { editMode: true, ownerMode: false })

const canEdit = computed(() => charCtx.ownerMode || charCtx.editMode)

const windowOpen = ref(false)
const nameInput = ref(null)

// race/class/subrace/subclass are item references `{ id, name }`; a legacy plain string is tolerated.
const form = reactive({ name: '', raceId: '', subraceId: '', classId: '', subclassId: '' })
const races = ref([])
const classes = ref([])
const subraces = ref([])
const subclasses = ref([])

// ─── avatar (own block, edited here too) ───────────────────────────────────
const avaInput = ref(null)
const avaDragging = ref(false)
const avaUploading = ref(false)
const avaValue = ref(null)
const avaUrl = computed(() => {
  const v = avaValue.value
  if (!v) return null
  if (typeof v === 'string') return v
  return v.url || null
})

const nameId     = computed(() => props.block.content?.name_id     || 'name')
const raceId     = computed(() => props.block.content?.race_id     || 'race')
const classId    = computed(() => props.block.content?.class_id    || 'class')
const subraceId  = computed(() => props.block.content?.subrace_id  || 'subrace')
const subclassId = computed(() => props.block.content?.subclass_id || 'subclass')
const avatarId   = computed(() => props.block.content?.avatar_id   || 'ava')

function nameOf(v) {
  if (v && typeof v === 'object') return v.name ?? ''
  return v == null ? '' : String(v)
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
const classVal    = computed(() => nameOf(props.values?.[classId.value]))
const subraceVal  = computed(() => nameOf(props.values?.[subraceId.value]))
const subclassVal = computed(() => nameOf(props.values?.[subclassId.value]))

const racePart  = computed(() => subraceVal.value || raceVal.value)
const classPart = computed(() => (classVal.value && subclassVal.value)
  ? `${classVal.value} (${subclassVal.value})`
  : (classVal.value || subclassVal.value))
const subline = computed(() => [racePart.value, classPart.value].filter(Boolean).join(' · '))

const nameColor = computed(() => props.block.content?.name_color || '#ffffff')
const nameStyle = computed(() => ({ color: nameColor.value }))

const raceOptions     = computed(() => toOptions(races.value))
const classOptions    = computed(() => toOptions(classes.value))
const subraceOptions  = computed(() => toOptions(subraces.value))
const subclassOptions = computed(() => toOptions(subclasses.value))

async function ensureBaseItems() {
  if (!races.value.length) {
    const items = (await fetchGet(`/items?typeId=${RACE_TYPE}&limit=500`))?.items || []
    races.value = items.filter((i) => i.parentId == null)
  }
  if (!classes.value.length) {
    const items = (await fetchGet(`/items?typeId=${CLASS_TYPE}&limit=500`))?.items || []
    classes.value = items.filter((i) => i.parentId == null)
  }
}
async function loadSubraces(parentId) {
  subraces.value = parentId
    ? ((await fetchGet(`/items/children?parentId=${parentId}`))?.items || []).filter((i) => i.typeId === RACE_TYPE)
    : []
}
async function loadSubclasses(parentId) {
  subclasses.value = parentId
    ? ((await fetchGet(`/items/children?parentId=${parentId}`))?.items || []).filter((i) => i.typeId === CLASS_TYPE)
    : []
}

async function onRaceChange(id) {
  form.raceId = id
  form.subraceId = ''
  await loadSubraces(id)
}
async function onClassChange(id) {
  form.classId = id
  form.subclassId = ''
  await loadSubclasses(id)
}

function openWindow() {
  windowOpen.value = true
}

watch(windowOpen, async (open) => {
  if (!open) return
  form.name       = nameVal.value
  form.raceId     = refId(props.values?.[raceId.value])
  form.subraceId  = refId(props.values?.[subraceId.value])
  form.classId    = refId(props.values?.[classId.value])
  form.subclassId = refId(props.values?.[subclassId.value])
  avaValue.value  = props.values?.[avatarId.value] ?? null
  avaDragging.value = false
  await ensureBaseItems()
  await Promise.all([
    loadSubraces(form.raceId || null),
    loadSubclasses(form.classId || null),
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
  if (file.size > 8 * 1024 * 1024) {
    alert('Файл слишком большой (максимум 8 МБ)')
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
  } finally {
    avaUploading.value = false
  }
}

function save() {
  emit('update:value', nameId.value, form.name)
  emit('update:value', raceId.value, resolveRef(races.value, form.raceId))
  emit('update:value', classId.value, resolveRef(classes.value, form.classId))
  emit('update:value', subraceId.value, resolveRef(subraces.value, form.subraceId))
  emit('update:value', subclassId.value, resolveRef(subclasses.value, form.subclassId))
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
  transition: color 0.12s, background 0.12s;
}
@media (hover: hover) { .dci-edit:hover { color: var(--accent); background: rgba(255, 255, 255, 0.06); } }

.dciw-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-1);
  padding-right: 24px;
}

.dciw-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* avatar uploader */
.dciw-ava {
  position: relative;
  width: 96px;
  height: 96px;
  border-radius: 14px;
  overflow: hidden;
  cursor: pointer;
  background-color: color-mix(in srgb, var(--accent) 18%, var(--block-bg));
  display: grid;
  place-items: center;
  transition: box-shadow 0.2s ease;
}
.dciw-ava--empty { border: 1px dashed var(--input-border); }
@media (hover: hover) { .dciw-ava:hover { box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 50%, transparent); } }
.dciw-ava--drag { box-shadow: 0 0 0 2px var(--accent), 0 0 20px color-mix(in srgb, var(--accent) 40%, transparent); }

.dciw-ava-img { width: 100%; height: 100%; object-fit: cover; object-position: top center; display: block; }
.dciw-ava-hint { font-size: 12px; letter-spacing: 0.04em; color: color-mix(in srgb, var(--accent) 60%, transparent); }
.dciw-ava-overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.5);
  color: rgba(255, 255, 255, 0.85);
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
