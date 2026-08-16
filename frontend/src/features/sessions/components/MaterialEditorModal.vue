<template>
  <AppModalFrame extra-wide :title="material ? 'Редактировать материал' : 'Новый материал'" @close="$emit('close')">
    <div class="material-form-grid">
      <FormField label="Название" vertical>
        <FormTextInput v-model:value="draft.name" :maxlength="160" autofocus />
      </FormField>
      <FormField label="Доступен" vertical>
        <FormSelect v-model:value="draft.scope">
          <option value="session">Во всей сессии</option>
          <option value="chapter">В одной главе</option>
          <option value="scene">В одном сценарии</option>
        </FormSelect>
      </FormField>
    </div>
    <div v-if="draft.scope !== 'session'" class="material-form-grid">
      <FormField label="Глава" vertical>
        <FormSelect v-model:value="draft.chapterId">
          <option :value="null" disabled>Выберите главу</option>
          <option v-for="chapter in chapters" :key="chapter.id" :value="chapter.id">{{ chapter.number }} · {{ chapter.name }}</option>
        </FormSelect>
      </FormField>
      <FormField v-if="draft.scope === 'scene'" label="Сценарий" vertical>
        <FormSelect v-model:value="draft.sceneId">
          <option :value="null" disabled>Выберите сценарий</option>
          <option v-for="scene in availableScenes" :key="scene.id" :value="scene.id">{{ scene.name }}</option>
        </FormSelect>
      </FormField>
    </div>
    <FormField label="Подпись для игроков" vertical>
      <FormTextarea v-model:value="draft.caption" :rows="3" :maxlength="2000" placeholder="Необязательный текст поверх изображения" />
    </FormField>
    <div class="material-image-section">
      <strong>Изображение</strong>
      <SessionImagePicker
        :model-value="draft.imageId"
        :current-url="preview"
        allow-upload
        :custom-selected="source === 'custom'"
        :custom-preview="preview"
        @select="pickCatalogImage"
        @upload="fileInput?.click()"
      />
      <input ref="fileInput" type="file" accept="image/*" hidden @change="onFile" />
      <span v-if="error" class="material-form-error">{{ error }}</span>
    </div>
    <template #footer>
      <FormActionButtons
        :submit-text="material ? 'Сохранить' : 'Добавить материал'"
        :loading="saving || uploading"
        :can-submit="canSubmit"
        @cancel="$emit('close')"
        @submit="submit"
      />
    </template>
  </AppModalFrame>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { AppModalFrame, FormActionButtons, FormField, FormSelect, FormTextInput, FormTextarea } from '@sylvieshare/share-ui'
import SessionImagePicker from '@/features/sessions/components/SessionImagePicker.vue'

const props = defineProps({
  material: { type: Object, default: null },
  chapters: { type: Array, default: () => [] },
  scenes: { type: Array, default: () => [] },
  defaultChapterId: { type: [Number, String], default: null },
  defaultSceneId: { type: [Number, String], default: null },
  saving: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'save'])
const draft = reactive({
  name: props.material?.name || '',
  caption: props.material?.caption || '',
  scope: props.material?.scope || (props.defaultSceneId ? 'scene' : props.defaultChapterId ? 'chapter' : 'session'),
  chapterId: props.material?.chapterId || Number(props.defaultChapterId) || null,
  sceneId: props.material?.sceneId || Number(props.defaultSceneId) || null,
  imageId: props.material?.imageId || 0,
})
const availableScenes = computed(() => props.scenes.filter(scene => String(scene.chapterId) === String(draft.chapterId)))
const source = ref(props.material ? 'custom' : 'catalog')
const preview = ref(props.material?.imageUrl || '')
const fileInput = ref(null)
const selectedFile = ref(null)
const objectUrl = ref('')
const uploading = ref(false)
const error = ref('')
const canSubmit = computed(() => !!draft.name.trim() && (!!draft.imageId || !!selectedFile.value)
  && (draft.scope === 'session' || !!draft.chapterId)
  && (draft.scope !== 'scene' || !!draft.sceneId))

watch(() => draft.chapterId, () => {
  if (draft.scope === 'scene' && !availableScenes.value.some(scene => String(scene.id) === String(draft.sceneId))) draft.sceneId = null
})

function pickCatalogImage(image) {
  source.value = 'catalog'
  draft.imageId = image.id
  preview.value = image.url
  selectedFile.value = null
}

function onFile(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  if (!file.type.startsWith('image/') || file.size > 15 * 1024 * 1024) {
    error.value = 'Выберите изображение до 15 МБ'
    return
  }
  if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
  objectUrl.value = URL.createObjectURL(file)
  selectedFile.value = file
  preview.value = objectUrl.value
  source.value = 'custom'
  error.value = ''
}

async function upload() {
  if (!selectedFile.value) return draft.imageId
  uploading.value = true
  try {
    const form = new FormData()
    form.append('file', selectedFile.value)
    const response = await fetch('/api/storage/images', { method: 'POST', body: form })
    if (!response.ok) throw new Error(String(response.status))
    return (await response.json()).upload_id
  } finally {
    uploading.value = false
  }
}

async function submit() {
  if (!canSubmit.value || props.saving || uploading.value) return
  error.value = ''
  try {
    emit('save', {
      name: draft.name.trim(), caption: draft.caption.trim() || null, scope: draft.scope,
      chapterId: draft.scope === 'session' ? null : Number(draft.chapterId),
      sceneId: draft.scope === 'scene' ? Number(draft.sceneId) : null,
      imageId: await upload(),
    })
  } catch {
    error.value = 'Не удалось загрузить изображение'
  }
}

onBeforeUnmount(() => { if (objectUrl.value) URL.revokeObjectURL(objectUrl.value) })
</script>

<style scoped>
.material-form-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(210px, .55fr); gap: 14px; }
.material-image-section { display: flex; flex-direction: column; gap: 9px; }
.material-image-section > strong { color: var(--text-2); font-size: 13px; }
.material-form-error { color: var(--danger); font-size: 12px; }
@media (max-width: 640px) { .material-form-grid { grid-template-columns: 1fr; } }
</style>
