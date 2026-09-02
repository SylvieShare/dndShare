<template>
  <AppModalFrame extra-wide :title="material ? 'Редактировать материал' : 'Новый материал'" @close="$emit('close')">
    <FormField label="Тип материала" vertical>
      <div class="material-type-grid">
        <button v-for="type in MATERIAL_TYPES" :key="type.key" type="button" :class="{ active: draft.kind === type.key }" @click="draft.kind = type.key">
          <component :is="type.icon" :size="19" /><span><strong>{{ type.label }}</strong><small>{{ type.hint }}</small></span>
        </button>
      </div>
    </FormField>

    <div class="material-editor-layout">
      <div class="material-editor-form">
        <SessionEditableField v-model="draft.name" label="Название" :icon="LibraryBig" force-open :multiline="false" :maxlength="160" autofocus required />

        <SessionEditableField v-if="draft.kind === 'text' || draft.kind === 'note'" v-model="draft.content" :label="draft.kind === 'note' ? 'Текст записки' : 'Текст'" :icon="AlignLeft" force-open :rows="9" :maxlength="20000" :placeholder="draft.kind === 'note' ? 'Что написано в записке…' : 'Текст для экрана игроков…'" required />
        <FormField v-if="draft.kind === 'note'" label="Оформление записки" vertical>
          <div class="note-style-grid">
            <button v-for="style in NOTE_STYLES" :key="style.key" type="button" :class="[`note-style--${style.key}`, { active: draft.noteStyle === style.key }]" @click="draft.noteStyle = style.key">{{ style.label }}</button>
          </div>
        </FormField>

        <SessionEditableField v-if="draft.kind !== 'text' && draft.kind !== 'note'" v-model="draft.caption" label="Подпись для игроков" :icon="Captions" force-open :rows="3" :maxlength="2000" placeholder="Необязательная подпись к материалу" />

        <div v-if="draft.kind === 'image' || draft.kind === 'map'" class="material-asset-section">
          <strong>{{ draft.kind === 'map' ? 'Изображение карты' : 'Изображение' }}</strong>
          <SessionImagePicker :model-value="draft.assetId" :current-url="preview" allow-upload :custom-selected="source === 'custom'" :custom-preview="preview" @select="pickCatalogImage" @upload="imageInput?.click()" />
          <input ref="imageInput" type="file" accept="image/*" hidden @change="onImageFile" />
          <span v-if="draft.kind === 'map'" class="material-form-hint">Карта уже хранится отдельным типом. Слои, области и метки можно будет добавить поверх неё позже.</span>
        </div>

        <div v-if="draft.kind === 'video'" class="material-asset-section">
          <strong>Видеофайл</strong>
          <video v-if="preview" class="material-video-preview" :src="preview" controls playsinline preload="metadata" />
          <button type="button" class="material-video-pick" @click="videoInput?.click()">{{ preview ? 'Сменить видео' : 'Выбрать видео' }}</button>
          <input ref="videoInput" type="file" accept="video/*" hidden @change="onVideoFile" />
          <span class="material-form-hint">До 100 МБ. Видео будет загружено в хранилище сессии.</span>
        </div>
      </div>

      <aside class="material-editor-relations">
        <div class="material-editor-relations-head">
          <strong>Связи материала</strong>
          <small>Связи помогают держать материал рядом с объектами кампании. Использование в сценариях определяется блоками холста.</small>
        </div>
		<section>
		  <div class="material-editor-section-title"><span>Объекты сессии</span><small>Все типы в одном списке</small></div>
		  <UniversalRelationEditor v-model="draft.relations" :items="relationItems" source-type="material" :source-id="material?.id" />
		</section>
      </aside>
    </div>

    <span v-if="error" class="material-form-error">{{ error }}</span>
    <template #footer>
      <FormActionButtons :submit-text="material ? 'Сохранить' : 'Добавить материал'" :loading="saving || uploading" :can-submit="canSubmit" @cancel="$emit('close')" @submit="submit" />
    </template>
  </AppModalFrame>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { AlignLeft, Captions, LibraryBig } from '@lucide/vue'
import { AppModalFrame, FormActionButtons, FormField } from '@sylvieshare/share-ui'
import SessionEditableField from '@/features/sessions/components/SessionEditableField.vue'
import SessionImagePicker from '@/features/sessions/components/SessionImagePicker.vue'
import UniversalRelationEditor from '@/features/sessions/components/UniversalRelationEditor.vue'
import { MATERIAL_TYPES, NOTE_STYLES } from '@/features/sessions/lib/sessionMaterials'

const props = defineProps({
	material: { type: Object, default: null }, saving: { type: Boolean, default: false },
	relationItems: { type: Array, default: () => [] },
})
const emit = defineEmits(['close', 'save'])
const draft = reactive({
  kind: props.material?.kind || 'image', name: props.material?.name || '', caption: props.material?.caption || '', content: props.material?.content || '', noteStyle: props.material?.noteStyle || 'parchment',
  assetId: props.material?.assetId || 0,
	relations: (props.material?.relations || []).map(link => ({ ...link })),
})
const source = ref(props.material ? 'custom' : 'catalog')
const preview = ref(props.material?.assetUrl || '')
const imageInput = ref(null)
const videoInput = ref(null)
const selectedFile = ref(null)
const objectUrl = ref('')
const uploading = ref(false)
const error = ref('')
const hasAsset = computed(() => !!draft.assetId || !!selectedFile.value)
const canSubmit = computed(() => !!draft.name.trim()
  && ((draft.kind === 'text' || draft.kind === 'note') ? !!draft.content.trim() : hasAsset.value))
let previousKind = draft.kind
watch(() => draft.kind, kind => {
  const sharedImageKinds = new Set(['image', 'map'])
  if (!(sharedImageKinds.has(kind) && sharedImageKinds.has(previousKind))) {
    clearSelectedFile(); draft.assetId = 0; preview.value = ''
  }
  previousKind = kind
  error.value = ''
})

function clearSelectedFile() {
  selectedFile.value = null
  if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
  objectUrl.value = ''
}
function pickCatalogImage(image) { clearSelectedFile(); source.value = 'catalog'; draft.assetId = image.id; preview.value = image.url }
function setFile(file) {
  clearSelectedFile(); objectUrl.value = URL.createObjectURL(file); selectedFile.value = file; preview.value = objectUrl.value; source.value = 'custom'; draft.assetId = 0; error.value = ''
}
function onImageFile(event) {
  const file = event.target.files?.[0]; event.target.value = ''; if (!file) return
  if (!file.type.startsWith('image/') || file.size > 15 * 1024 * 1024) { error.value = 'Выберите изображение до 15 МБ'; return }
  setFile(file)
}
function onVideoFile(event) {
  const file = event.target.files?.[0]; event.target.value = ''; if (!file) return
  if (!file.type.startsWith('video/') || file.size > 100 * 1024 * 1024) { error.value = 'Выберите видео до 100 МБ'; return }
  setFile(file)
}
async function uploadAsset() {
  if (!selectedFile.value) return draft.assetId || null
  uploading.value = true
  try {
    const form = new FormData(); form.append('file', selectedFile.value)
    const endpoint = draft.kind === 'video' ? '/api/storage/videos' : '/api/storage/images'
    const response = await fetch(endpoint, { method: 'POST', body: form })
    if (!response.ok) throw new Error(String(response.status))
    return (await response.json()).upload_id
  } finally { uploading.value = false }
}
async function submit() {
  if (!canSubmit.value || props.saving || uploading.value) return
  error.value = ''
  try {
    const needsAsset = !['text', 'note'].includes(draft.kind)
    emit('save', {
      kind: draft.kind, name: draft.name.trim(), caption: needsAsset ? (draft.caption.trim() || null) : null,
      content: needsAsset ? null : draft.content.trim(), noteStyle: draft.kind === 'note' ? draft.noteStyle : null,
      assetId: needsAsset ? await uploadAsset() : null,
		relations: draft.relations,
    })
  } catch { error.value = draft.kind === 'video' ? 'Не удалось загрузить видео' : 'Не удалось загрузить изображение' }
}
onBeforeUnmount(clearSelectedFile)
</script>

<style scoped>
.material-editor-layout { display: grid; grid-template-columns: minmax(0, 1.12fr) minmax(320px, .88fr); gap: 24px; }.material-editor-form, .material-editor-relations, .material-editor-relations section { min-width: 0; display: flex; flex-direction: column; gap: 14px; }.material-editor-relations { padding-left: 22px; border-left: 1px solid var(--border); }.material-editor-relations section + section { padding-top: 14px; border-top: 1px solid var(--border); }.material-editor-relations-head { display: flex; flex-direction: column; gap: 4px; }.material-editor-relations-head strong { color: var(--text-1); font-size: 13px; }.material-editor-relations-head small { color: var(--text-muted); font-size: 10px; line-height: 1.4; }.material-editor-section-title { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; color: var(--text-1); font-size: 12px; font-weight: 700; }.material-editor-section-title small { color: var(--text-muted); font-size: 10px; font-weight: 500; }.material-type-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 7px; }.material-type-grid button { min-width: 0; display: flex; align-items: flex-start; gap: 8px; padding: 10px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-raised); color: var(--text-2); text-align: left; cursor: pointer; }.material-type-grid button.active { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, var(--surface-raised)); color: var(--accent-soft); }.material-type-grid button > span { min-width: 0; display: flex; flex-direction: column; gap: 3px; }.material-type-grid strong { color: var(--text-1); font-size: 11px; }.material-type-grid small { color: var(--text-muted); font-size: 8px; line-height: 1.35; }
.material-asset-section { display: flex; flex-direction: column; gap: 9px; }.material-asset-section > strong { color: var(--text-2); font-size: 13px; }.material-form-error { color: var(--danger); font-size: 12px; }.material-form-hint { color: var(--text-muted); font-size: 10px; }.material-video-preview { width: 100%; max-height: 320px; border: 1px solid var(--border); border-radius: 10px; background: var(--bg); }.material-video-pick { align-self: flex-start; padding: 8px 11px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-raised); color: var(--text-1); cursor: pointer; }
.note-style-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }.note-style-grid button { min-height: 58px; border: 2px solid transparent; border-radius: 6px; cursor: pointer; font: 650 11px var(--font-ui); }.note-style-grid button.active { border-color: var(--accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 20%, transparent); }.note-style--parchment { background: var(--material-note-parchment-bg); color: var(--material-note-parchment-text); }.note-style--letter { background: var(--material-note-letter-bg); color: var(--material-note-letter-text); }.note-style--dossier { background: var(--material-note-dossier-bg); color: var(--material-note-dossier-text); box-shadow: inset 0 0 0 5px var(--material-note-dossier-border); }.note-style--arcane { background: radial-gradient(circle, var(--material-note-arcane-glow), var(--material-note-arcane-bg)); color: var(--material-note-arcane-text); }
@media (max-width: 760px) { .material-editor-layout { grid-template-columns: 1fr; }.material-editor-relations { padding: 16px 0 0; border-top: 1px solid var(--border); border-left: 0; }.material-type-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }.note-style-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
