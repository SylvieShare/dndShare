<template>
  <div class="persona-media">
    <div class="portrait-column">
      <div
        class="media-drop portrait-drop"
        :class="{ 'is-dragging': dragging === 'portrait', 'has-image': portraitUrl }"
        role="button"
        tabindex="0"
        aria-label="Выбрать портрет персонажа"
        @click="choose('portrait')"
        @keydown.enter.prevent="choose('portrait')"
        @keydown.space.prevent="choose('portrait')"
        @dragover.prevent="dragging = 'portrait'"
        @dragleave.prevent="dragging = ''"
        @drop.prevent="onDrop('portrait', $event)"
      >
        <img v-if="portraitUrl" :src="portraitUrl" alt="Портрет персонажа" />
        <div v-else class="media-placeholder">
          <ImagePlus :size="34" :stroke-width="1.7" aria-hidden="true" />
          <b>Добавить портрет</b>
          <span>Перетащи изображение или выбери файл</span>
        </div>
        <div v-if="uploading === 'portrait'" class="media-progress">
          <LoaderCircle :size="28" aria-hidden="true" />
          <span>Загрузка…</span>
        </div>
      </div>

      <div class="media-actions">
        <button type="button" @click="choose('portrait')">
          <Upload :size="15" aria-hidden="true" />
          <span class="action-label">{{ portraitUrl ? 'Заменить' : 'Загрузить' }}</span>
        </button>
        <button v-if="portraitUrl" type="button" @click="cropCurrent('portrait')">
          <Crop :size="15" aria-hidden="true" />
          <span class="action-label">Кадрировать</span>
        </button>
        <button v-if="portraitUrl" class="danger" type="button" title="Удалить портрет" @click="clear('portrait')">
          <Trash2 :size="15" aria-hidden="true" />
        </button>
      </div>
    </div>

    <div class="icon-column">
      <div class="media-copy">
        <strong>Иконка персонажа</strong>
        <p>Для карточки и сессии. Без неё используется портрет.</p>
      </div>

      <div
        class="media-drop icon-drop"
        :class="{ 'is-dragging': dragging === 'icon', 'has-image': iconUrl }"
        role="button"
        tabindex="0"
        aria-label="Выбрать иконку персонажа"
        @click="choose('icon')"
        @keydown.enter.prevent="choose('icon')"
        @keydown.space.prevent="choose('icon')"
        @dragover.prevent="dragging = 'icon'"
        @dragleave.prevent="dragging = ''"
        @drop.prevent="onDrop('icon', $event)"
      >
        <img v-if="iconUrl" :src="iconUrl" alt="Иконка персонажа" />
        <div v-else class="media-placeholder icon-placeholder">
          <CircleUserRound :size="30" :stroke-width="1.7" aria-hidden="true" />
          <span>Выбрать иконку</span>
        </div>
        <div v-if="uploading === 'icon'" class="media-progress">
          <LoaderCircle :size="24" aria-hidden="true" />
        </div>
      </div>

      <div class="media-actions icon-actions">
        <button type="button" :title="iconUrl ? 'Заменить иконку' : 'Загрузить иконку'" @click="choose('icon')">
          <Upload :size="15" aria-hidden="true" />
          <span class="action-label">{{ iconUrl ? 'Заменить' : 'Загрузить' }}</span>
        </button>
        <button v-if="iconUrl" type="button" title="Кадрировать иконку" @click="cropCurrent('icon')">
          <Crop :size="15" aria-hidden="true" />
          <span class="action-label">Кадрировать</span>
        </button>
        <button v-if="iconUrl" class="danger" type="button" title="Удалить иконку" @click="clear('icon')">
          <Trash2 :size="15" aria-hidden="true" />
        </button>
      </div>
    </div>

    <input ref="portraitInput" type="file" accept="image/*" hidden @change="onFile('portrait', $event)" />
    <input ref="iconInput" type="file" accept="image/*" hidden @change="onFile('icon', $event)" />
    <p v-if="error" class="media-error" role="alert">{{ error }}</p>

    <AvatarCropModal
      v-if="cropSource"
      :src="cropSource"
      :aspect="cropKind === 'icon' ? 1 : 0.8"
      @close="closeCrop"
      @crop="uploadCrop"
    />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { CircleUserRound, Crop, ImagePlus, LoaderCircle, Trash2, Upload } from '@lucide/vue'
import AvatarCropModal from '@/features/character-editor/components/AvatarCropModal.vue'

const props = defineProps({
  portrait: { type: Object, default: null },
  icon: { type: Object, default: null },
})
const emit = defineEmits(['update:portrait', 'update:icon'])

const portraitInput = ref(null)
const iconInput = ref(null)
const dragging = ref('')
const uploading = ref('')
const error = ref('')
const cropSource = ref('')
const cropKind = ref('portrait')
let cropObjectUrl = ''

const portraitUrl = computed(() => props.portrait?.url || '')
const iconUrl = computed(() => props.icon?.url || '')

function choose(kind) {
  if (uploading.value) return
  error.value = ''
  ;(kind === 'icon' ? iconInput : portraitInput).value?.click()
}

function onFile(kind, event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (file) openCrop(kind, file)
}

function onDrop(kind, event) {
  dragging.value = ''
  const file = event.dataTransfer?.files?.[0]
  if (file?.type?.startsWith('image/')) openCrop(kind, file)
}

function clearCropObjectUrl() {
  if (cropObjectUrl) URL.revokeObjectURL(cropObjectUrl)
  cropObjectUrl = ''
}

function openCrop(kind, file) {
  error.value = ''
  const maxBytes = kind === 'icon' ? 5 * 1024 * 1024 : 8 * 1024 * 1024
  if (file.size > maxBytes) {
    error.value = kind === 'icon' ? 'Иконка должна быть не больше 5 МБ' : 'Портрет должен быть не больше 8 МБ'
    return
  }
  clearCropObjectUrl()
  cropObjectUrl = URL.createObjectURL(file)
  cropSource.value = cropObjectUrl
  cropKind.value = kind
}

async function cropCurrent(kind) {
  error.value = ''
  try {
    const value = kind === 'icon' ? props.icon : props.portrait
    const source = value?.upload_id ? `/api/storage/images/${value.upload_id}` : value?.url
    const response = await fetch(source)
    if (!response.ok) throw new Error(String(response.status))
    openCrop(kind, await response.blob())
  } catch {
    error.value = 'Не удалось открыть изображение для кадрирования'
  }
}

function closeCrop() {
  cropSource.value = ''
  clearCropObjectUrl()
}

async function resizeIcon(blob) {
  const sourceUrl = URL.createObjectURL(blob)
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = reject
      element.src = sourceUrl
    })
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const context = canvas.getContext('2d')
    if (!context) throw new Error('canvas unavailable')
    context.drawImage(image, 0, 0, 256, 256)
    return await new Promise((resolve, reject) => {
      canvas.toBlob(value => value ? resolve(value) : reject(new Error('icon resize failed')), 'image/webp', 0.9)
    })
  } finally {
    URL.revokeObjectURL(sourceUrl)
  }
}

async function uploadCrop(blob) {
  const kind = cropKind.value
  closeCrop()
  try {
    const prepared = kind === 'icon' ? await resizeIcon(blob) : blob
    await upload(kind, new File([prepared], `${kind}.webp`, { type: 'image/webp' }))
  } catch {
    error.value = 'Не удалось подготовить изображение'
  }
}

async function upload(kind, file) {
  error.value = ''
  uploading.value = kind
  const previous = kind === 'icon' ? props.icon : props.portrait
  try {
    const formData = new FormData()
    formData.append('file', file)
    if (kind === 'icon') formData.append('purpose', 'character_icon')
    if (previous?.upload_id) formData.append('old_upload_id', previous.upload_id)
    const response = await fetch('/api/storage/images', { method: 'POST', body: formData })
    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent('dndshare:request-auth'))
      throw new Error('auth')
    }
    if (!response.ok) throw new Error(String(response.status))
    const data = await response.json()
    emit(`update:${kind}`, { url: data.url, upload_id: data.upload_id })
  } catch (uploadError) {
    error.value = uploadError?.message === 'auth'
      ? 'Войди в аккаунт, чтобы загрузить изображение'
      : 'Не удалось загрузить изображение'
  } finally {
    uploading.value = ''
  }
}

function clear(kind) {
  error.value = ''
  emit(`update:${kind}`, null)
}

onBeforeUnmount(clearCropObjectUrl)
</script>

<style scoped>
.persona-media {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  align-content: start;
  min-width: 0;
}
.portrait-column, .icon-column { min-width: 0; }
.portrait-column { display: flex; flex-direction: column; gap: 8px; }
.icon-column {
  align-self: start;
  display: grid;
  grid-template-columns: 60px minmax(0, 1fr);
  grid-template-rows: auto auto;
  align-items: center;
  gap: 6px 10px;
  padding: 9px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: color-mix(in srgb, var(--surface-raised) 80%, transparent);
}
.media-copy { grid-column: 2; align-self: center; }
.media-copy strong { display: block; color: var(--text); font-size: 12px; }
.media-copy p { margin: 3px 0 0; color: var(--text-muted); font-size: 9px; line-height: 1.35; }
.media-drop {
  position: relative;
  overflow: hidden;
  border: 1px dashed var(--border-strong);
  background:
    radial-gradient(circle at 50% 18%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 48%),
    var(--surface-raised);
  cursor: pointer;
  transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease;
}
.media-drop:hover, .media-drop:focus-visible, .media-drop.is-dragging {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 14%, transparent);
  outline: none;
}
.media-drop.is-dragging { transform: translateY(-2px); }
.portrait-drop { width: 100%; aspect-ratio: 4 / 5; border-radius: 18px; }
.icon-drop { grid-column: 1; grid-row: 1; width: 60px; aspect-ratio: 1; border-radius: 15px; }
.media-drop img { width: 100%; height: 100%; display: block; object-fit: cover; object-position: top center; }
.media-placeholder, .media-progress {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 18px;
  color: color-mix(in srgb, var(--accent) 76%, var(--text));
  text-align: center;
}
.media-placeholder b { font-size: 13px; }
.media-placeholder span { max-width: 170px; color: var(--text-muted); font-size: 10px; line-height: 1.4; }
.icon-placeholder { gap: 6px; padding: 10px; }
.icon-placeholder span { display: none; }
.media-progress { background: color-mix(in srgb, var(--surface) 78%, transparent); backdrop-filter: blur(3px); font-size: 11px; }
.media-progress svg { animation: media-spin .8s linear infinite; }
.media-actions { display: flex; gap: 5px; min-width: 0; }
.media-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-width: 0;
  min-height: 30px;
  padding: 5px 8px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--surface-raised);
  color: var(--text-2);
  font: inherit;
  font-size: 10px;
  cursor: pointer;
}
.media-actions button:hover { border-color: var(--border-strong); color: var(--text); }
.media-actions .danger { margin-left: auto; color: var(--danger); }
.icon-actions { grid-column: 2; }
.icon-actions button { width: 28px; min-height: 27px; padding: 4px; }
.icon-actions .action-label { display: none; }
.icon-actions .danger { margin-left: 0; }
.media-error { grid-column: 1 / -1; margin: 0; color: var(--danger); font-size: 11px; }
@keyframes media-spin { to { transform: rotate(360deg); } }

@media (max-width: 700px) {
  .portrait-drop { border-radius: 15px; }
  .portrait-column .media-actions { flex-wrap: wrap; }
  .portrait-column .media-actions button { flex: 1 1 auto; }
  .icon-column { grid-template-columns: 60px minmax(0, 1fr); padding: 9px; }
  .icon-drop { width: 60px; border-radius: 15px; }
}

@media (max-width: 480px) {
  .persona-media { grid-template-columns: 1fr; }
  .portrait-column { display: grid; grid-template-columns: 116px minmax(0, 1fr); align-items: end; gap: 8px 10px; }
  .portrait-drop { grid-row: 1 / span 2; }
  .portrait-column::after {
    content: 'Портрет будет виден на листе персонажа';
    align-self: start;
    color: var(--text-muted);
    font-size: 10px;
    line-height: 1.4;
  }
  .portrait-column .media-actions { align-self: end; }
  .portrait-column .media-actions button { flex-basis: 100%; }
}
</style>
