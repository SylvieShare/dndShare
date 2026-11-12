<template>
  <div v-if="photos.length || owner" class="photo-gallery" aria-label="Галерея персонажа">
    <MorphTileHeader title="Галерея" :show-edit="false" />
    <div class="photo-strip" data-sheet-horizontal-scroll>
      <RowActionMenu v-for="(photo, index) in photos" :key="photo.uid" title="Действия с фотографией">
        <template #trigger="{ open }">
          <button class="photo-thumb" type="button" :aria-label="`Фотография ${index + 1}`" aria-haspopup="menu" :aria-expanded="open">
            <CharacterPhotoImage :src="photo.thumbnailUrl || photo.url" :alt="photo.name || `Фотография ${index + 1}`" fit="natural" />
          </button>
        </template>
        <template #default="{ close }">
          <RowActionItem :icon="Expand" @click="viewing = photo; close()">Посмотреть</RowActionItem>
          <RowActionItem v-if="coverState.foldable" :icon="PanelsTopLeft" :disabled="!coverState.available || coverState.pendingOwner === ownerId && coverState.pendingPhotoUid === photo.uid" @click="present(photo); close()">
            {{ selected(photo) ? coverState.active ? 'Показать ещё раз на внешнем экране' : 'Возобновить показ на внешнем экране' : 'Показывать на внешнем экране' }}
            <small v-if="!coverState.available" class="photo-menu-hint">{{ coverState.reason }}</small>
          </RowActionItem>
          <RowActionItem v-if="selected(photo)" :icon="PanelTopClose" @click="stopCoverPhoto(ownerId, photo.uid); close()">Убрать с внешнего экрана</RowActionItem>
          <RowActionItem v-if="owner" :icon="Trash2" tone="danger" @click="removing = photo; close()">Удалить</RowActionItem>
        </template>
      </RowActionMenu>
      <div v-for="entry in pending" :key="entry.uid" class="photo-thumb photo-pending"><CharacterPhotoImage :src="entry.preview" alt="Загружаемая фотография" fit="natural" /><LoadingIndicator label="Загрузка фотографии" size="sm" /></div>
      <ActionButton v-if="owner" class="photo-add" layout="stacked" variant="dashed" :disabled="uploading" @click="input.click()"><template #icon><Plus :size="24" /></template>Добавить</ActionButton>
    </div>
    <input ref="input" class="photo-file-input" type="file" multiple accept="image/*" aria-label="Добавить фотографии" @change="selectFiles" />
    <p v-if="error" class="photo-error" role="alert">{{ error }}</p>
    <AppModalFrame v-if="viewing" title="Фотография персонажа" fullscreen :padded="false" :body-scroll="false" @close="viewing = null">
      <div class="photo-fullscreen"><CharacterPhotoImage :src="viewing.url" :alt="viewing.name || 'Фотография персонажа'" fit="contain" retryable /></div>
    </AppModalFrame>
    <ConfirmDialog v-if="removing" title="Удалить фотографию?" message="Фотография будет убрана из галереи этого персонажа." confirm-label="Удалить" @confirm="removePhoto" @cancel="removing = null" />
  </div>
</template>

<script setup>
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue'
import { ActionButton, AppModalFrame, ConfirmDialog, LoadingIndicator, MorphTileHeader, RowActionItem, RowActionMenu } from '@sylvieshare/share-ui'
import { Expand, PanelsTopLeft, PanelTopClose, Plus, Trash2 } from '@lucide/vue'
import { prepareImageUpload, PORTRAIT_IMAGE_MAX_BYTES } from '@/shared/lib/imageUpload'
import { coverState, showCoverPhoto, stopCoverPhoto } from '@/platform/coverDisplay'
import CharacterPhotoImage from './CharacterPhotoImage.vue'

const props = defineProps({ block: Object, value: { type: Array, default: () => [] } })
const emit = defineEmits(['update:value'])
const context = inject('charCtx', {})
const owner = computed(() => Boolean(context.ownerMode))
const ownerId = computed(() => String(context.characterUuid || ''))
const photos = computed(() => Array.isArray(props.value) ? props.value : [])
function selected(photo) { return coverState.owner === ownerId.value && coverState.photoUid === photo.uid || coverState.pendingOwner === ownerId.value && coverState.pendingPhotoUid === photo.uid }
const input = ref(null), viewing = ref(null), removing = ref(null), error = ref(''), pending = ref([]), uploading = ref(false)
let disposed = false
const controller = new AbortController()

async function selectFiles(event) {
  const files = [...event.target.files]
  event.target.value = ''
  if (!owner.value || uploading.value) return
  uploading.value = true
  error.value = ''
  for (const file of files) {
    if (disposed) break
    const uid = crypto.randomUUID(), preview = URL.createObjectURL(file)
    pending.value.push({ uid, preview })
    try {
      const prepared = await prepareImageUpload(file, { maxBytes: PORTRAIT_IMAGE_MAX_BYTES, maxDimension: 4096 })
      const thumbnail = await prepareImageUpload(prepared, { maxBytes: PORTRAIT_IMAGE_MAX_BYTES, maxDimension: 320 })
      if (disposed) break
      const thumb = await upload(thumbnail)
      if (disposed) break
      const full = thumbnail === prepared ? thumb : await upload(prepared)
      if (!disposed) emit('update:value', props.block.id, [...photos.value, { uid, imageId: full.upload_id, url: full.url, thumbnailId: thumb.upload_id, thumbnailUrl: thumb.url, name: file.name }])
    } catch (problem) {
      if (!disposed) error.value = `${file.name}: ${problem.message || 'Не удалось загрузить фотографию. Повторите попытку.'}`
    } finally {
      pending.value = pending.value.filter(entry => entry.uid !== uid)
      URL.revokeObjectURL(preview)
    }
  }
  uploading.value = false
}
async function upload(file) {
  const form = new FormData()
  form.append('file', file)
  const response = await fetch('/api/storage/images', { method: 'POST', body: form, signal: controller.signal })
  const result = await response.json()
  if (!response.ok) throw new Error(result.desc || 'Не удалось загрузить фотографию')
  if (!result.upload_id || !result.url) throw new Error('Сервер не вернул загруженную фотографию')
  return result
}

async function present(photo) {
  error.value = ''
  try { await showCoverPhoto(ownerId.value, photo) } catch (problem) { error.value = problem.message }
}
async function removePhoto() {
  const photo = removing.value
  removing.value = null
  if (!photo || !owner.value) return
  await stopCoverPhoto(ownerId.value, photo.uid)
  emit('update:value', props.block.id, photos.value.filter(entry => entry.uid !== photo.uid))
}
onBeforeUnmount(() => { disposed = true; controller.abort(); pending.value.forEach(entry => URL.revokeObjectURL(entry.preview)) })
watch(() => photos.value.map(photo => photo.uid), (ids, previous) => {
  for (const uid of previous || []) if (!ids.includes(uid)) void stopCoverPhoto(ownerId.value, uid)
})
</script>

<style scoped>
.photo-gallery { display:grid;gap:var(--spacing-small);min-width:0 }
.photo-strip { display:flex;align-items:stretch;gap:var(--spacing-small);overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x proximity;scrollbar-width:thin;padding-block:var(--spacing-xs);max-width:100% }
.photo-strip > * { flex:none;scroll-snap-align:start }
.photo-thumb { display:grid;place-items:center;height:var(--layout-sheet-gallery-height);padding:0;border:0;border-radius:var(--r-md);background:var(--surface-raised);overflow:hidden;cursor:pointer }
.photo-thumb > * { grid-area:1/1;min-width:0 }
.photo-thumb:focus-visible { outline:2px solid var(--accent);outline-offset:-2px }
.photo-add { width:var(--layout-sheet-gallery-add-width);--action-button-height:var(--layout-sheet-gallery-height) }
.photo-pending { position:relative }
.photo-pending > .character-photo-image { opacity:.4 }
.photo-pending > :last-child { position:absolute }
.photo-file-input { display:none }
.photo-error { color:var(--danger);font-size:12px;margin:var(--spacing-small) 0 0 }
.photo-menu-hint { display:block;font-size:11px;color:var(--text-muted);margin-top:4px;max-width:230px }
.photo-fullscreen { display:grid;place-items:center;width:100%;height:100%;min-height:0;background:var(--bg) }
.photo-fullscreen img { display:block;max-width:100%;max-height:100%;width:100%;height:100%;object-fit:contain }
</style>
