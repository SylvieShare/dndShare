<template>
  <section class="session-music-workspace" aria-label="Музыкальная библиотека">
    <MusicLibrarySidebar
      :personal-track-count="personalTracks.length"
      :personal-albums="personalAlbums"
      :system-albums="systemAlbums"
      :selected-album-id="selectedAlbumId"
      :selected-album-is-system="!!selectedAlbum?.isSystem"
      :drop-active="dropActive"
      :drag-target-album-id="organizer.dragTargetAlbumId.value"
      @select-album="selectedAlbumId = $event"
      @create-album="onCreateAlbum"
      @open-files="openFilePicker"
      @drag-enter="onDragEnter"
      @drag-leave="onDragLeave"
      @file-drop="onDrop"
    />
    <input ref="fileInputEl" type="file" accept="audio/*" multiple hidden @change="onFiles" />

    <div class="music-lib-main-col">
      <div class="music-lib-main-pane">
        <section class="music-lib-main">
        <div class="ml-main-head">
          <span class="ml-main-color-dot" :style="{ background: selectedAlbum?.color || 'var(--text-muted)' }" />
          <h3 class="ml-main-title">{{ selectedAlbum ? selectedAlbum.name : 'Все треки' }}</h3>
          <span class="ml-main-sub">{{ filteredTracks.length }} треков</span>
          <span
            v-if="selectedAlbum?.isSystem"
            class="ml-main-license"
            :title="`${selectedAlbum.licenseName || 'CC0'} · ${selectedAlbum.author || 'автор указан в источнике'}`"
          >
            <a v-if="selectedAlbum.licenseUrl" :href="selectedAlbum.licenseUrl" target="_blank" rel="noopener noreferrer">{{ selectedAlbum.licenseName || 'CC0' }}</a>
            <span v-else>{{ selectedAlbum.licenseName || 'CC0' }}</span>
            <span> · </span>
            <a v-if="selectedAlbum.sourceUrl" :href="selectedAlbum.sourceUrl" target="_blank" rel="noopener noreferrer">{{ selectedAlbum.author || 'источник' }} ↗</a>
            <span v-else>{{ selectedAlbum.author }}</span>
          </span>
          <div v-if="selectedAlbum && !selectedAlbum.isSystem" class="ml-main-actions">
            <button class="ml-main-action" @click="onRenameAlbum">переименовать</button>
            <button class="ml-main-action ml-main-action--danger" @click="onDeleteAlbum">удалить альбом</button>
          </div>
        </div>

        <div class="ml-search-row">
          <input v-model="searchQuery" class="ml-search" type="text" placeholder="Поиск по названию или тегу..." />
        </div>
        <div class="ml-tags">
          <span class="ml-tags-label">ТЕГИ</span>
          <button
            v-for="tag in musicStore.tags"
            :key="tag.id"
            class="ml-tag"
            :class="{ active: activeTagIds.includes(tag.id) }"
            @click="toggleTagFilter(tag.id)"
          >
            {{ tag.name }} <span v-if="activeTagIds.includes(tag.id)" class="ml-tag-x">×</span>
          </button>
          <button class="ml-tags-edit" @click="tagManagerOpen = true">изменить теги</button>
        </div>

        <div class="ml-tracks" data-sortable-container="tracks">
          <MusicTrackRow
            v-for="track in organizer.sortable.displayItems('tracks')"
            :key="track.id"
            :track="track"
            :is-playing="state.playing && state.trackId === track.id"
            :is-current="state.trackId === track.id"
            :is-queued="isQueued(track.id)"
            :is-placeholder="organizer.sortable.isSource(track)"
            :system="track.isSystem"
            :selected="organizer.selectedTrackIds.value.includes(track.id)"
            :draggable="organizer.canDragTrack(track)"
            :on-drag-start="organizer.startDrag"
            @select="organizer.selectTrack"
            @play="onPlay"
            @queue-toggle="onQueueToggle"
            @rename="onRenameTrack"
            @delete="onDeleteTrack"
            @change-albums="onChangeAlbums"
            @change-tags="onChangeTags"
          />
          <div v-if="!displayedTracks.length" class="ml-empty">Нет треков</div>
        </div>
        </section>

        <Transition name="music-selection-bar">
          <div v-if="organizer.selectedTracks.value.length" class="ml-selection-bar">
            <span class="ml-selection-count">Выбрано: {{ organizer.selectedTracks.value.length }}</span>
            <button @click="openBulkAlbums">В альбомы…</button>
            <button @click="openBulkTags">Теги…</button>
            <button v-if="selectedAlbum && !selectedAlbum.isSystem" @click="removeSelectedFromAlbum">Убрать из альбома</button>
            <button v-if="selectedOnlyPersonal" class="danger" @click="deleteSelected">Удалить</button>
            <button class="clear" @click="organizer.clearSelection">Снять выделение</button>
          </div>
        </Transition>
      </div>
      <MusicLibraryPlayerFooter :is-dm="isDm" />
    </div>

    <div v-if="visibleStatus" class="music-lib-toast">{{ visibleStatus }}</div>

    <AppModalFrame v-if="tagPickerTrackIds.length" :title="tagPickerTitle" :z-index="2300" @close="tagPickerTrackIds = []">
      <div class="album-picker">
        <div class="album-picker-list">
          <label v-for="tag in musicStore.tags" :key="tag.id" class="album-picker-row">
            <input type="checkbox" :checked="pickerTracksHaveTag(tag.id)" @change="onToggleTrackTag(tag, $event.target.checked)" />
            <span class="album-picker-name">{{ tag.name }}</span>
          </label>
          <div v-if="!musicStore.tags.length" class="album-picker-empty">Создайте теги в окне «изменить теги»</div>
        </div>
      </div>
      <template #footer><button class="album-picker-close" @click="tagPickerTrackIds = []">Готово</button></template>
    </AppModalFrame>

    <AppModalFrame v-if="tagManagerOpen" title="Теги" :z-index="2300" @close="tagManagerOpen = false">
      <div class="album-picker">
        <div class="tag-manager-list">
          <div v-for="tag in musicStore.tags" :key="tag.id" class="tag-manager-row">
            <template v-if="editingTagId === tag.id">
              <input ref="tagEditInput" v-model="editingTagName" class="tag-manager-input" type="text" maxlength="64" @keydown.enter="commitTagEdit" @keydown.escape="cancelTagEdit" @keydown.stop />
              <button class="tag-manager-btn" @click="commitTagEdit">✓</button>
              <button class="tag-manager-btn" @click="cancelTagEdit">×</button>
            </template>
            <template v-else>
              <span class="tag-manager-name">{{ tag.name }}</span>
              <button class="tag-manager-btn" title="Переименовать" @click="startTagEdit(tag)">✎</button>
              <button class="tag-manager-btn tag-manager-btn--danger" title="Удалить" @click="onDeleteTag(tag)">×</button>
            </template>
          </div>
          <div v-if="!musicStore.tags.length" class="album-picker-empty">Тегов пока нет</div>
        </div>
        <div class="tag-manager-new">
          <input v-model="newTagName" class="tag-manager-input" type="text" placeholder="новый тег" maxlength="64" @keydown.enter="onCreateTag" @keydown.stop />
          <button class="album-picker-close" :disabled="!newTagName.trim() || creatingTag" @click="onCreateTag">+ добавить</button>
        </div>
      </div>
      <template #footer><button class="album-picker-close" @click="tagManagerOpen = false">Готово</button></template>
    </AppModalFrame>

    <AppModalFrame v-if="albumPickerTrackIds.length" :title="albumPickerTitle" :z-index="2300" @close="albumPickerTrackIds = []">
      <div class="album-picker">
        <div class="album-picker-list">
          <label v-for="album in personalAlbums" :key="album.id" class="album-picker-row">
            <input type="checkbox" :checked="pickerTracksInAlbum(album.id)" @change="onToggleTrackAlbum(album, $event.target.checked)" />
            <span class="album-picker-dot" :style="{ background: album.color || 'var(--accent)' }" />
            <span class="album-picker-name">{{ album.name }}</span>
          </label>
          <div v-if="!personalAlbums.length" class="album-picker-empty">Создайте альбом в сайдбаре</div>
        </div>
      </div>
      <template #footer><button class="album-picker-close" @click="albumPickerTrackIds = []">Готово</button></template>
    </AppModalFrame>

    <TextPromptDialog v-if="textPrompt" :title="textPrompt.title" :value="textPrompt.value" :loading="dialogLoading" @cancel="textPrompt = null" @confirm="confirmTextPrompt" />
    <ConfirmDialog v-if="deleteTarget" :title="deleteTarget.title" :message="deleteTarget.message" confirm-label="Удалить" :loading="dialogLoading" @cancel="deleteTarget = null" @confirm="confirmDelete" />
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { AppModalFrame, ConfirmDialog, TextPromptDialog } from '@sylvieshare/share-ui'
import MusicLibraryPlayerFooter from '@/features/sessions/components/MusicLibraryPlayerFooter.vue'
import MusicLibrarySidebar from '@/features/sessions/components/MusicLibrarySidebar.vue'
import MusicTrackRow from '@/features/sessions/components/MusicTrackRow.vue'
import { useMusicTrackOrganizer } from '@/features/sessions/composables/useMusicTrackOrganizer'
import { useTrackUpload } from '@/features/sessions/composables/useTrackUpload'
import { useMusicStore } from '@/stores/music'

const props = defineProps({ isDm: { type: Boolean, default: false } })
const musicStore = useMusicStore()
const { state } = storeToRefs(musicStore)
const selectedAlbumId = ref(null)
const searchQuery = ref('')
const activeTagIds = ref([])
const albumPickerTrackIds = ref([])
const tagPickerTrackIds = ref([])
const tagManagerOpen = ref(false)
const editingTagId = ref(null)
const editingTagName = ref('')
const newTagName = ref('')
const creatingTag = ref(false)
const tagEditInput = ref(null)
const textPrompt = ref(null)
const deleteTarget = ref(null)
const dialogLoading = ref(false)
const organizerStatus = ref('')
let statusTimer = null

const personalTracks = computed(() => musicStore.tracks.filter(track => !track.isSystem))
const personalAlbums = computed(() => musicStore.albums.filter(album => !album.isSystem))
const systemAlbums = computed(() => musicStore.albums.filter(album => album.isSystem))
const selectedAlbum = computed(() => selectedAlbumId.value ? musicStore.albumById(selectedAlbumId.value) : null)

const { dropActive, uploadStatus, fileInputEl, openFilePicker, onDragEnter, onDragLeave, onFiles, onDrop } =
  useTrackUpload({ musicStore, currentAlbumId: selectedAlbumId })
const visibleStatus = computed(() => uploadStatus.value || organizerStatus.value)

watch(selectedAlbumId, async id => { if (id) await musicStore.loadAlbumTracks(id).catch(() => {}) })
onMounted(() => musicStore.ensureLibrary())

const filteredTracks = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  const base = selectedAlbumId.value ? musicStore.tracks : personalTracks.value
  return base.filter(track => {
    if (selectedAlbumId.value && !(track.albumIds || []).includes(selectedAlbumId.value)) return false
    if (query && !track.name.toLowerCase().includes(query)
      && !(track.tags || []).some(tag => tag.name.toLowerCase().includes(query))) return false
    const ids = (track.tags || []).map(tag => tag.id)
    return activeTagIds.value.every(id => ids.includes(id))
  })
})
const displayedTracks = computed(() => {
  const order = selectedAlbumId.value ? (musicStore.albumOrder[selectedAlbumId.value] || []) : []
  if (!order.length) return filteredTracks.value
  const byId = new Map(filteredTracks.value.map(track => [track.id, track]))
  const result = order.flatMap(id => byId.has(id) ? [byId.get(id)] : [])
  for (const track of result) byId.delete(track.id)
  return [...result, ...byId.values()]
})
const canSort = computed(() => !!selectedAlbumId.value && !selectedAlbum.value?.isSystem
  && !searchQuery.value.trim() && !activeTagIds.value.length)
const organizer = useMusicTrackOrganizer({
  displayedTracks, selectedAlbumId, personalAlbums, canSort, musicStore, setStatus,
})
const selectedOnlyPersonal = computed(() => organizer.selectedTracks.value.every(track => !track.isSystem))
const albumPickerTitle = computed(() => pickerTitle('Альбомы', albumPickerTrackIds.value))
const tagPickerTitle = computed(() => pickerTitle('Теги', tagPickerTrackIds.value))

function setStatus(message) {
  organizerStatus.value = message
  clearTimeout(statusTimer)
  statusTimer = setTimeout(() => { organizerStatus.value = '' }, 2500)
}
function pickerTitle(label, ids) {
  if (ids.length > 1) return `${label} для выбранных треков (${ids.length})`
  return `${label} для «${musicStore.trackById(ids[0])?.name || 'трек'}»`
}
function toggleTagFilter(id) {
  activeTagIds.value = activeTagIds.value.includes(id)
    ? activeTagIds.value.filter(value => value !== id)
    : [...activeTagIds.value, id]
}
function isQueued(id) { return state.value.nextTrackId === id }
function onPlay(track) {
  if (!props.isDm) return
  if (state.value.trackId === track.id) state.value.playing ? musicStore.pause() : musicStore.resume()
  else musicStore.playTrack(track.id, { albumId: selectedAlbumId.value })
}
function onQueueToggle(track) {
  if (!props.isDm) return
  isQueued(track.id) ? musicStore.clearNext() : musicStore.setNext(track.id)
}
function onRenameTrack(track) {
  if (!track.isSystem) textPrompt.value = { kind: 'track', target: track, title: 'Новое название трека', value: track.name }
}
function onDeleteTrack(track) {
  if (!track.isSystem) deleteTarget.value = { kind: 'tracks', ids: [track.id], title: 'Удалить трек?', message: `«${track.name}»` }
}
function onChangeAlbums(track) { albumPickerTrackIds.value = [track.id] }
function onChangeTags(track) { tagPickerTrackIds.value = [track.id] }
function openBulkAlbums() { albumPickerTrackIds.value = organizer.selectedTrackIds.value.slice() }
function openBulkTags() { tagPickerTrackIds.value = organizer.selectedTrackIds.value.slice() }
function pickerTracksInAlbum(albumId) {
  return albumPickerTrackIds.value.every(id => (musicStore.trackById(id)?.albumIds || []).includes(albumId))
}
function pickerTracksHaveTag(tagId) {
  return tagPickerTrackIds.value.every(id => (musicStore.trackById(id)?.tags || []).some(tag => tag.id === tagId))
}
async function onToggleTrackAlbum(album, checked) {
  const ids = albumPickerTrackIds.value.slice()
  if (checked) await musicStore.addTracksToAlbum(album.id, ids)
  else await musicStore.removeTracksFromAlbum(album.id, ids)
}
async function onToggleTrackTag(tag, checked) {
  const ids = tagPickerTrackIds.value.slice()
  if (checked) await musicStore.attachTracksTag(ids, tag.id)
  else await musicStore.removeTracksTag(ids, tag.id)
}
async function removeSelectedFromAlbum() {
  if (!selectedAlbumId.value) return
  await musicStore.removeTracksFromAlbum(selectedAlbumId.value, organizer.selectedTrackIds.value)
  organizer.clearSelection()
}
function deleteSelected() {
  const ids = organizer.selectedTrackIds.value.slice()
  deleteTarget.value = { kind: 'tracks', ids, title: 'Удалить выбранные треки?', message: `Будет удалено треков: ${ids.length}` }
}
function startTagEdit(tag) {
  editingTagId.value = tag.id; editingTagName.value = tag.name
  nextTick(() => { const input = Array.isArray(tagEditInput.value) ? tagEditInput.value[0] : tagEditInput.value; input?.focus?.(); input?.select?.() })
}
function cancelTagEdit() { editingTagId.value = null; editingTagName.value = '' }
async function commitTagEdit() {
  const id = editingTagId.value; const name = editingTagName.value.trim()
  if (id && name) await musicStore.renameTag(id, name).catch(() => {})
  cancelTagEdit()
}
function onDeleteTag(tag) {
  deleteTarget.value = { kind: 'tag', target: tag, title: 'Удалить тег?', message: `«${tag.name}» будет снят со всех треков.` }
}
async function onCreateTag() {
  const name = newTagName.value.trim()
  if (!name || creatingTag.value) return
  creatingTag.value = true
  try { await musicStore.createTag(name); newTagName.value = '' } finally { creatingTag.value = false }
}
function onCreateAlbum() { textPrompt.value = { kind: 'album-create', title: 'Название альбома', value: '' } }
function onRenameAlbum() {
  if (selectedAlbum.value && !selectedAlbum.value.isSystem) textPrompt.value = { kind: 'album-rename', target: selectedAlbum.value, title: 'Новое название альбома', value: selectedAlbum.value.name }
}
function onDeleteAlbum() {
  if (selectedAlbum.value && !selectedAlbum.value.isSystem) deleteTarget.value = { kind: 'album', target: selectedAlbum.value, title: 'Удалить альбом?', message: `«${selectedAlbum.value.name}». Треки останутся в библиотеке.` }
}
async function confirmTextPrompt(name) {
  const action = textPrompt.value
  if (!action || dialogLoading.value || name === action.value) return
  dialogLoading.value = true
  try {
    if (action.kind === 'track') await musicStore.renameTrack(action.target.id, name)
    if (action.kind === 'album-rename') await musicStore.updateAlbum(action.target.id, { name })
    if (action.kind === 'album-create') {
      const album = await musicStore.createAlbum({ name, color: pickColor() })
      selectedAlbumId.value = album.id
    }
    textPrompt.value = null
  } finally { dialogLoading.value = false }
}
async function confirmDelete() {
  const action = deleteTarget.value
  if (!action || dialogLoading.value) return
  dialogLoading.value = true
  try {
    if (action.kind === 'tracks') { await musicStore.deleteTracks(action.ids); organizer.clearSelection() }
    if (action.kind === 'tag') { await musicStore.deleteTag(action.target.id); activeTagIds.value = activeTagIds.value.filter(id => id !== action.target.id) }
    if (action.kind === 'album') { selectedAlbumId.value = null; await musicStore.deleteAlbum(action.target.id) }
    deleteTarget.value = null
  } finally { dialogLoading.value = false }
}
const ALBUM_COLORS = ['#7c5ce2', '#5ce87c', '#e89c3c', '#e85c5c', '#5cb5e8', '#e85cc6']
function pickColor() { return ALBUM_COLORS[personalAlbums.value.length % ALBUM_COLORS.length] }
</script>

<style scoped src="./styles/SessionMusicWorkspace.css"></style>
