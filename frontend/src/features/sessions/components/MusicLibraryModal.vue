<template>
  <AppModal fullscreen :z-index="2200" @close="onClose">
    <div class="music-lib">
        <header class="music-lib-head">
          <h2 class="music-lib-title">Музыкальная библиотека</h2>
          <span class="music-lib-count">{{ musicStore.tracks.length }} треков</span>
          <span class="music-lib-sub">· ваша коллекция</span>
          <div class="music-lib-head-actions">
            <button class="music-lib-close" @click="onClose">×</button>
          </div>
        </header>

        <input ref="fileInputEl" type="file" accept="audio/*" multiple hidden @change="onFiles" />

        <div class="music-lib-body">
          <aside class="music-lib-sidebar">
            <div class="sb-section-title">
              АЛЬБОМЫ
              <button class="sb-add" @click="onCreateAlbum">+</button>
            </div>

            <button
              class="sb-album"
              :class="{ active: !selectedAlbumId }"
              @click="selectedAlbumId = null"
            >
              <span class="sb-album-dot" :style="{ background: 'var(--text-muted)' }" />
              <span class="sb-album-name">Все треки</span>
              <span class="sb-album-count">{{ musicStore.tracks.length }}</span>
            </button>

            <button
              v-for="album in musicStore.albums"
              :key="album.id"
              class="sb-album"
              :class="{ active: selectedAlbumId === album.id }"
              @click="selectedAlbumId = album.id"
            >
              <span class="sb-album-dot" :style="{ background: album.color || 'var(--accent)' }" />
              <span class="sb-album-name">{{ album.name }}</span>
              <span class="sb-album-count">{{ album.trackCount }}</span>
            </button>

            <button class="music-lib-dropzone" :class="{ active: dropActive }"
                 type="button"
                 @click="openFilePicker"
                 @dragenter.prevent="onDragEnter"
                 @dragleave.prevent="onDragLeave"
                 @dragover.prevent
                 @drop.prevent="onDrop">
              <div class="music-lib-dropzone-icon">＋</div>
              <div>Перетащите файлы<br>или нажмите</div>
              <div class="music-lib-dropzone-sub">.mp3 / .ogg / .flac · до 50 МБ</div>
            </button>
          </aside>

          <div class="music-lib-main-col">
          <section class="music-lib-main">
            <div class="ml-main-head">
              <span class="ml-main-color-dot" :style="{ background: selectedAlbum?.color || 'var(--text-muted)' }" />
              <h3 class="ml-main-title">{{ selectedAlbum ? selectedAlbum.name : 'Все треки' }}</h3>
              <span class="ml-main-sub">{{ filteredTracks.length }} треков</span>
              <div class="ml-main-actions" v-if="selectedAlbum">
                <button class="ml-main-action" @click="onRenameAlbum">переименовать</button>
                <button class="ml-main-action ml-main-action--danger" @click="onDeleteAlbum">удалить альбом</button>
              </div>
            </div>

            <div class="ml-search-row">
              <input
                v-model="searchQuery"
                class="ml-search"
                type="text"
                placeholder="Поиск по названию или тегу..."
              />
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
                {{ tag.name }}
                <span v-if="activeTagIds.includes(tag.id)" class="ml-tag-x">×</span>
              </button>
              <button class="ml-tags-edit" @click="tagManagerOpen = true">
                изменить теги
              </button>
            </div>

            <div class="ml-tracks" data-sortable-container="tracks">
              <MusicTrackRow
                v-for="t in sortable.displayItems('tracks')"
                :key="t.id"
                :track="t"
                :is-playing="state.playing && state.trackId === t.id"
                :is-current="state.trackId === t.id"
                :is-queued="isQueued(t.id)"
                :is-placeholder="sortable.isSource(t)"
                :draggable="canSort"
                :on-drag-start="canSort ? startDragHandler : null"
                @play="onPlay"
                @queue-toggle="onQueueToggle"
                @rename="onRenameTrack"
                @delete="onDeleteTrack"
                @change-albums="onChangeAlbums"
                @change-tags="onChangeTags"
              />
              <div v-if="!displayedTracks.length" class="ml-empty">
                Нет треков
              </div>
            </div>
          </section>

          <footer v-if="current" class="music-lib-foot">
          <div class="foot-current">
            <button class="foot-play-btn" @click="onFootPlayPause">
              <svg v-if="!state.playing" width="14" height="14" viewBox="0 0 14 14">
                <path d="M3.5 2.5v9l8-4.5-8-4.5z" fill="currentColor"/>
              </svg>
              <svg v-else width="14" height="14" viewBox="0 0 14 14">
                <rect x="3.5" y="2.5" width="2.6" height="9" fill="currentColor"/>
                <rect x="7.9" y="2.5" width="2.6" height="9" fill="currentColor"/>
              </svg>
            </button>
            <button
              class="foot-loop-btn"
              :class="{ active: state.loopMode === 'track' }"
              :title="state.loopMode === 'track' ? 'Повтор одного трека' : 'Повтор альбома'"
              @click="onToggleLoop"
            >
              <svg v-if="state.loopMode === 'track'" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 5h7l-1.5-1.5M13 11H6l1.5 1.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M3 5v3a3 3 0 0 0 3 3M13 11V8a3 3 0 0 0-3-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                <text x="8" y="9.5" text-anchor="middle" font-size="5" font-weight="700" fill="currentColor">1</text>
              </svg>
              <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 5h7l-1.5-1.5M13 11H6l1.5 1.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M3 5v3a3 3 0 0 0 3 3M13 11V8a3 3 0 0 0-3-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              </svg>
            </button>
            <div class="foot-text">
              <div class="foot-status"><span class="foot-status-dot" />{{ state.playing ? 'ИГРАЕТ' : 'ПАУЗА' }}</div>
              <div class="foot-title" :title="current.name">{{ current.name }}</div>
              <div class="foot-progress" :class="{ 'foot-progress--clickable': isDm }" @click="onFootSeek">
                <div class="foot-progress-bar" :style="{ width: progressPct + '%' }" />
              </div>
              <div class="foot-time">{{ fmtTime(state.positionSec) }} / {{ fmtTime(state.durationSec) }}</div>
            </div>
          </div>

          <div class="foot-cross">
            <button class="foot-cross-btn" :disabled="!next" @click="onFootPlayNext">
              <svg width="13" height="13" viewBox="0 0 14 14">
                <path d="M2 2l5 5-5 5M7 2l5 5-5 5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Переключить сейчас
            </button>
            <div class="foot-cross-fade">
              <span class="foot-cross-fade-label">фейд</span>
              <AppSlider :model-value="state.crossfadeDurSec" :min="0" :max="15" :step="0.5" @update:model-value="musicStore.setCrossfade" />
              <span class="foot-cross-fade-value">{{ state.crossfadeDurSec.toFixed(1) }}с</span>
            </div>
            <div class="foot-cross-fade">
              <span class="foot-cross-fade-label">громкость</span>
              <AppSlider :model-value="state.volume" :min="0" :max="1" :step="0.01" @update:model-value="musicStore.setVolume" />
              <span class="foot-cross-fade-value">{{ Math.round(state.volume * 100) }}%</span>
            </div>
          </div>

          <div class="foot-next">
            <div class="foot-next-head">
              <span class="foot-next-label">СЛЕДУЮЩИЙ</span>
              <button v-if="next" class="foot-next-clear" @click="onClearNext" title="Убрать">× убрать</button>
            </div>
            <div v-if="next" class="foot-next-title" :title="next.name">{{ next.name }}</div>
            <div v-else class="foot-next-empty">не выбран</div>
            <div v-if="next" class="foot-next-meta">{{ fmtTime(next.durationSec) }}<template v-if="nextAlbum"> · из «{{ nextAlbum.name }}»</template></div>
          </div>
          </footer>
          </div>
        </div>

        <div v-if="uploadStatus" class="music-lib-toast">
          {{ uploadStatus }}
        </div>

        <AppModal v-if="tagPickerTrack" tile :z-index="2300" @close="tagPickerTrack = null">
          <div class="album-picker">
            <div class="album-picker-title">Теги для «{{ tagPickerTrack.name }}»</div>
            <div class="album-picker-list">
              <label v-for="tag in musicStore.tags" :key="tag.id" class="album-picker-row">
                <input
                  type="checkbox"
                  :checked="(tagPickerTrack.tags || []).some(t => t.id === tag.id)"
                  @change="onToggleTrackTag(tag, $event.target.checked)"
                />
                <span class="album-picker-name">{{ tag.name }}</span>
              </label>
              <div v-if="!musicStore.tags.length" class="album-picker-empty">Создайте теги в окне «изменить теги»</div>
            </div>
            <div class="album-picker-actions">
              <button class="album-picker-close" @click="tagPickerTrack = null">Готово</button>
            </div>
          </div>
        </AppModal>

        <AppModal v-if="tagManagerOpen" tile :z-index="2300" @close="tagManagerOpen = false">
          <div class="album-picker">
            <div class="album-picker-title">Теги</div>
            <div class="tag-manager-list">
              <div v-for="tag in musicStore.tags" :key="tag.id" class="tag-manager-row">
                <template v-if="editingTagId === tag.id">
                  <input
                    ref="tagEditInput"
                    v-model="editingTagName"
                    class="tag-manager-input"
                    type="text"
                    maxlength="64"
                    @keydown.enter="commitTagEdit"
                    @keydown.escape="cancelTagEdit"
                    @keydown.stop
                  />
                  <button class="tag-manager-btn" @click="commitTagEdit">✓</button>
                  <button class="tag-manager-btn" @click="cancelTagEdit">×</button>
                </template>
                <template v-else>
                  <span class="tag-manager-name">{{ tag.name }}</span>
                  <button class="tag-manager-btn" title="Переименовать" @click="startTagEdit(tag)">
                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                      <path d="M2 12L4 11.5L11.5 4L10 2.5L2.5 10L2 12Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
                    </svg>
                  </button>
                  <button class="tag-manager-btn tag-manager-btn--danger" title="Удалить" @click="onDeleteTag(tag)">×</button>
                </template>
              </div>
              <div v-if="!musicStore.tags.length" class="album-picker-empty">Тегов пока нет</div>
            </div>
            <div class="tag-manager-new">
              <input
                v-model="newTagName"
                class="tag-manager-input"
                type="text"
                placeholder="новый тег"
                maxlength="64"
                @keydown.enter="onCreateTag"
                @keydown.stop
              />
              <button class="album-picker-close" :disabled="!newTagName.trim() || creatingTag" @click="onCreateTag">
                + добавить
              </button>
            </div>
            <div class="album-picker-actions">
              <button class="album-picker-close" @click="tagManagerOpen = false">Готово</button>
            </div>
          </div>
        </AppModal>

        <AppModal v-if="albumPickerTrack" tile :z-index="2300" @close="albumPickerTrack = null">
          <div class="album-picker">
            <div class="album-picker-title">Альбомы для «{{ albumPickerTrack.name }}»</div>
            <div class="album-picker-list">
              <label v-for="album in musicStore.albums" :key="album.id" class="album-picker-row">
                <input
                  type="checkbox"
                  :checked="(albumPickerTrack.albumIds || []).includes(album.id)"
                  @change="onToggleTrackAlbum(album, $event.target.checked)"
                />
                <span class="album-picker-dot" :style="{ background: album.color || 'var(--accent)' }" />
                <span class="album-picker-name">{{ album.name }}</span>
              </label>
              <div v-if="!musicStore.albums.length" class="album-picker-empty">Создайте альбом в сайдбаре</div>
            </div>
            <div class="album-picker-actions">
              <button class="album-picker-close" @click="albumPickerTrack = null">Готово</button>
            </div>
          </div>
        </AppModal>
      <TextPromptDialog
        v-if="textPrompt"
        :title="textPrompt.title"
        :value="textPrompt.value"
        :loading="dialogLoading"
        @cancel="textPrompt = null"
        @confirm="confirmTextPrompt"
      />
      <ConfirmDialog
        v-if="deleteTarget"
        :title="deleteTarget.title"
        :message="deleteTarget.message"
        confirm-label="Удалить"
        :loading="dialogLoading"
        @cancel="deleteTarget = null"
        @confirm="confirmDelete"
      />
    </div>
  </AppModal>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import MusicTrackRow from '@/features/sessions/components/MusicTrackRow.vue'
import { useTrackUpload } from '@/features/sessions/composables/useTrackUpload'
import { fmtTime } from '@/features/sessions/lib/musicLibrary'
import { reorderByDrop, useSortable } from '@/shared/composables/useSortable'
import AppModal from '@/shared/ui/AppModal.vue'
import AppSlider from '@/shared/ui/AppSlider.vue'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'
import TextPromptDialog from '@/shared/ui/TextPromptDialog.vue'
import { useMusicStore } from '@/stores/music'

const props = defineProps({
  isDm: { type: Boolean, default: false },
})
const emit = defineEmits(['close'])

const musicStore = useMusicStore()
const { state, currentTrack, nextTrack } = storeToRefs(musicStore)

const selectedAlbumId = ref(null)
const searchQuery = ref('')
const activeTagIds = ref([])
const albumPickerTrack = ref(null)
const tagPickerTrack = ref(null)
const tagManagerOpen = ref(false)
const editingTagId = ref(null)
const editingTagName = ref('')
const newTagName = ref('')
const creatingTag = ref(false)
const tagEditInput = ref(null)
const textPrompt = ref(null)
const deleteTarget = ref(null)
const dialogLoading = ref(false)

const {
  dropActive,
  uploadStatus,
  fileInputEl,
  openFilePicker,
  onDragEnter,
  onDragLeave,
  onFiles,
  onDrop,
} = useTrackUpload({ musicStore, currentAlbumId: selectedAlbumId })

watch(selectedAlbumId, async (id) => {
  if (id) await musicStore.loadAlbumTracks(id).catch(() => {})
})

const current = currentTrack
const next = nextTrack
const nextAlbum = computed(() => state.value.albumId ? musicStore.albumById(state.value.albumId) : null)
const progressPct = computed(() => {
  if (!state.value.durationSec) return 0
  return Math.min(100, (state.value.positionSec / state.value.durationSec) * 100)
})


function onFootPlayPause() {
  if (!props.isDm || !current.value) return
  if (state.value.playing) musicStore.pause()
  else musicStore.resume()
}
function onFootSeek(e) {
  if (!props.isDm || !current.value || !state.value.durationSec) return
  const rect = e.currentTarget.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  musicStore.seek(ratio * state.value.durationSec)
}
function onFootPlayNext() {
  if (!props.isDm) return
  musicStore.playNextFromQueue()
}
function onClearNext() {
  if (!props.isDm) return
  musicStore.clearNext()
}
onMounted(() => musicStore.ensureLibrary())

const selectedAlbum = computed(() => selectedAlbumId.value ? musicStore.albumById(selectedAlbumId.value) : null)

const filteredTracks = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return musicStore.tracks.filter(t => {
    if (selectedAlbumId.value && !(t.albumIds || []).includes(selectedAlbumId.value)) return false
    if (q) {
      const inName = t.name.toLowerCase().includes(q)
      const inTags = (t.tags || []).some(tag => tag.name.toLowerCase().includes(q))
      if (!inName && !inTags) return false
    }
    if (activeTagIds.value.length) {
      const ids = (t.tags || []).map(g => g.id)
      if (!activeTagIds.value.every(id => ids.includes(id))) return false
    }
    return true
  })
})

// When viewing an album, order by saved positions (no client-side search/tag changes the order).
const displayedTracks = computed(() => {
  const aid = selectedAlbumId.value
  if (!aid) return filteredTracks.value
  const order = musicStore.albumOrder[aid] || []
  if (!order.length) return filteredTracks.value
  const byId = new Map(filteredTracks.value.map(t => [t.id, t]))
  const ordered = []
  for (const id of order) {
    if (byId.has(id)) { ordered.push(byId.get(id)); byId.delete(id) }
  }
  // append any tracks not in saved order (newly added, fallback)
  for (const t of filteredTracks.value) if (byId.has(t.id)) ordered.push(t)
  return ordered
})

const canSort = computed(() => !!selectedAlbumId.value && !searchQuery.value.trim() && !activeTagIds.value.length)

const sortable = useSortable({
  groups: {
    tracks: { items: displayedTracks },
  },
  getKey: (t) => t.id,
  onDrop: async ({ fromIndex, toIndex }) => {
    if (!selectedAlbumId.value) return
    if (fromIndex === toIndex) return
    const ids = reorderByDrop(displayedTracks.value.map(t => t.id), fromIndex, toIndex)
    await musicStore.reorderAlbum(selectedAlbumId.value, ids).catch(() => {})
  },
})

function startDragHandler(e, track) {
  const idx = displayedTracks.value.findIndex(t => t.id === track.id)
  if (idx === -1) return
  sortable.startDrag(e, track, 'tracks', idx)
}

function toggleTagFilter(id) {
  activeTagIds.value = activeTagIds.value.includes(id)
    ? activeTagIds.value.filter(x => x !== id)
    : [...activeTagIds.value, id]
}

function isQueued(trackId) {
  return state.value.nextTrackId === trackId
}

function onPlay(track) {
  if (!props.isDm) return
  if (state.value.trackId === track.id) {
    if (state.value.playing) musicStore.pause()
    else musicStore.resume()
  } else {
    musicStore.playTrack(track.id, { albumId: selectedAlbumId.value })
  }
}
function onQueueToggle(track) {
  if (!props.isDm) return
  if (isQueued(track.id)) musicStore.clearNext()
  else musicStore.setNext(track.id)
}
function onRenameTrack(track) {
  textPrompt.value = { kind: 'track', target: track, title: 'Новое название трека', value: track.name }
}
function onDeleteTrack(track) {
  deleteTarget.value = { kind: 'track', target: track, title: 'Удалить трек?', message: `«${track.name}»` }
}

function onChangeAlbums(track) {
  albumPickerTrack.value = track
}
async function onToggleTrackAlbum(album, checked) {
  if (!albumPickerTrack.value) return
  const trackId = albumPickerTrack.value.id
  if (checked) await musicStore.addTrackToAlbum(album.id, trackId)
  else await musicStore.removeTrackFromAlbum(album.id, trackId)
  const updated = musicStore.trackById(trackId)
  if (updated) albumPickerTrack.value = updated
}

function onChangeTags(track) {
  tagPickerTrack.value = track
}
async function onToggleTrackTag(tag, checked) {
  if (!tagPickerTrack.value) return
  const trackId = tagPickerTrack.value.id
  if (checked) await musicStore.attachTrackTag(trackId, tag.id)
  else await musicStore.removeTrackTag(trackId, tag.id)
  const updated = musicStore.trackById(trackId)
  if (updated) tagPickerTrack.value = updated
}

function startTagEdit(tag) {
  editingTagId.value = tag.id
  editingTagName.value = tag.name
  nextTick(() => {
    const el = Array.isArray(tagEditInput.value) ? tagEditInput.value[0] : tagEditInput.value
    el?.focus?.(); el?.select?.()
  })
}
function cancelTagEdit() {
  editingTagId.value = null
  editingTagName.value = ''
}
async function commitTagEdit() {
  const id = editingTagId.value
  const name = editingTagName.value.trim()
  if (!id || !name) { cancelTagEdit(); return }
  await musicStore.renameTag(id, name).catch(() => {})
  cancelTagEdit()
}
function onDeleteTag(tag) {
  deleteTarget.value = {
    kind: 'tag', target: tag, title: 'Удалить тег?',
    message: `«${tag.name}» будет снят со всех треков.`,
  }
}
async function onCreateTag() {
  const name = newTagName.value.trim()
  if (!name || creatingTag.value) return
  creatingTag.value = true
  try {
    await musicStore.createTag(name)
    newTagName.value = ''
  } finally {
    creatingTag.value = false
  }
}

function onToggleLoop() {
  if (!props.isDm) return
  musicStore.toggleLoopMode()
}

function onCreateAlbum() {
  textPrompt.value = { kind: 'album-create', title: 'Название альбома', value: '' }
}
function onRenameAlbum() {
  if (!selectedAlbum.value) return
  textPrompt.value = { kind: 'album-rename', target: selectedAlbum.value, title: 'Новое название альбома', value: selectedAlbum.value.name }
}
function onDeleteAlbum() {
  if (!selectedAlbum.value) return
  deleteTarget.value = {
    kind: 'album', target: selectedAlbum.value, title: 'Удалить альбом?',
    message: `«${selectedAlbum.value.name}». Треки останутся в библиотеке.`,
  }
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
  } finally {
    dialogLoading.value = false
  }
}

async function confirmDelete() {
  const action = deleteTarget.value
  if (!action || dialogLoading.value) return
  dialogLoading.value = true
  try {
    if (action.kind === 'track') await musicStore.deleteTrack(action.target.id)
    if (action.kind === 'tag') {
      await musicStore.deleteTag(action.target.id)
      activeTagIds.value = activeTagIds.value.filter(id => id !== action.target.id)
    }
    if (action.kind === 'album') {
      selectedAlbumId.value = null
      await musicStore.deleteAlbum(action.target.id)
    }
    deleteTarget.value = null
  } finally {
    dialogLoading.value = false
  }
}

const ALBUM_COLORS = ['#7c5ce2', '#5ce87c', '#e89c3c', '#e85c5c', '#5cb5e8', '#e85cc6']
function pickColor() {
  return ALBUM_COLORS[musicStore.albums.length % ALBUM_COLORS.length]
}

function onClose() {
  emit('close')
}
</script>

<style scoped>
.music-lib {
  background: var(--bg);
  border: 1px solid var(--border-strong);
  border-radius: 18px;
  width: 100%;
  height: 100%;
  display: flex; flex-direction: column;
  overflow: hidden;
  box-shadow: 0 12px 48px var(--scrim);
  position: relative;
}

.music-lib-head {
  display: flex; align-items: baseline; gap: 14px;
  padding: 18px 24px;
  border-bottom: 1px solid var(--popover-bg);
  background: var(--bg);
  flex-shrink: 0;
}
.music-lib-title { font-family: var(--font-display); font-size: 24px; font-weight: 600; color: var(--text-1); margin: 0; }
.music-lib-count {
  background: color-mix(in srgb, var(--text-on-accent) 5%, transparent);
  border-radius: 6px;
  padding: 3px 9px;
  font-size: 11px;
  color: var(--text-2);
  letter-spacing: 0.04em;
  font-weight: 600;
}
.music-lib-sub { font-size: 13px; color: var(--text-muted); }
.music-lib-head-actions { margin-left: auto; display: flex; align-items: center; gap: 12px; }
.music-lib-close {
  background: none; border: none; color: var(--text-2);
  font-size: 24px; cursor: pointer; line-height: 1;
  padding: 0 4px;
}
.music-lib-close:hover { color: var(--text-1); }

.music-lib-body {
  display: flex; flex: 1 1 auto; min-height: 0;
  overflow: hidden;
}

.music-lib-sidebar {
  width: 260px; flex-shrink: 0;
  border-right: 1px solid var(--popover-bg);
  padding: 16px 12px;
  display: flex; flex-direction: column; gap: 4px;
  overflow-y: auto;
  background: var(--bg);
}
.sb-section-title {
  display: flex; align-items: center;
  font-size: 10px; letter-spacing: 0.08em; font-weight: 700;
  color: var(--text-muted);
  padding: 0 6px 6px;
}
.sb-add {
  margin-left: auto;
  width: 22px; height: 22px;
  background: none; border: 1px solid var(--surface-active);
  border-radius: 5px;
  color: var(--text-2); cursor: pointer;
  font: inherit; font-size: 14px; line-height: 1;
}
.sb-add:hover { border-color: var(--accent); color: var(--accent); }

.sb-album {
  display: flex; align-items: center; gap: 10px;
  width: 100%;
  background: none; border: none;
  padding: 8px 10px;
  border-radius: 8px;
  color: var(--text-2);
  font: inherit; font-size: 13px;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
}
.sb-album:hover { background: color-mix(in srgb, var(--text-on-accent) 4%, transparent); }
.sb-album.active { background: color-mix(in srgb, var(--accent) 15%, transparent); color: var(--text-on-accent); }
.sb-album-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.sb-album-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sb-album-count { color: var(--text-muted); font-size: 11px; }
.sb-album.active .sb-album-count { color: var(--text-2); }

.music-lib-dropzone {
  margin-top: auto;
  padding: 18px 14px;
  border: 1px dashed var(--border-strong);
  border-radius: 10px;
  text-align: center;
  color: var(--text-2);
  font-size: 12px;
  cursor: pointer;
  background: none;
  font-family: inherit;
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.music-lib-dropzone > * { pointer-events: none; }
.music-lib-dropzone:hover { border-color: var(--surface-active); color: var(--text-2); background: color-mix(in srgb, var(--text-on-accent) 2%, transparent); }
.music-lib-dropzone.active { border-color: var(--accent); color: var(--accent); background: color-mix(in srgb, var(--accent) 5%, transparent); }
.music-lib-dropzone-icon { font-size: 22px; line-height: 1; }
.music-lib-dropzone-sub { font-size: 10px; }

.music-lib-main-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.music-lib-main {
  flex: 1;
  display: flex; flex-direction: column;
  min-width: 0; min-height: 0;
  padding: 20px 24px;
  gap: 14px;
  overflow-y: auto;
  background: var(--bg);
}
.ml-main-head { display: flex; align-items: center; gap: 12px; }
.ml-main-color-dot { width: 12px; height: 12px; border-radius: 3px; }
.ml-main-title { font-family: var(--font-display); font-size: 22px; font-weight: 600; color: var(--text-1); margin: 0; }
.ml-main-sub { font-size: 12px; color: var(--text-muted); }
.ml-main-actions { margin-left: auto; display: flex; gap: 14px; }
.ml-main-action {
  background: none; border: none; color: var(--text-2);
  font: inherit; font-size: 12px; cursor: pointer;
}
.ml-main-action:hover { color: var(--text-2); }
.ml-main-action--danger:hover { color: var(--danger); }

.ml-search {
  width: 100%;
  background: color-mix(in srgb, var(--text-on-accent) 4%, transparent);
  border: 1px solid var(--surface-raised);
  border-radius: 8px;
  padding: 10px 14px;
  color: var(--text-1); font: inherit; font-size: 13px;
  outline: none;
}
.ml-search:focus { border-color: var(--accent); }

.ml-tags { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ml-tags-label { font-size: 10px; letter-spacing: 0.08em; font-weight: 700; color: var(--text-muted); }
.ml-tag {
  background: color-mix(in srgb, var(--text-on-accent) 4%, transparent);
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 4px 10px;
  color: var(--text-2);
  font: inherit; font-size: 12px;
  cursor: pointer;
  display: inline-flex; align-items: center; gap: 4px;
}
.ml-tag:hover { background: var(--border); }
.ml-tag.active { background: color-mix(in srgb, var(--accent) 18%, transparent); color: var(--accent); border-color: color-mix(in srgb, var(--accent) 35%, transparent); }
.ml-tag-x { color: var(--accent); }
.ml-tags-edit {
  margin-left: 6px;
  background: none;
  border: 1px dashed var(--surface-active);
  border-radius: 6px;
  color: var(--text-2);
  font: inherit; font-size: 11px;
  padding: 4px 10px;
  cursor: pointer;
  text-transform: lowercase;
  transition: border-color 0.15s, color 0.15s;
}
.ml-tags-edit:hover { border-color: var(--accent); color: var(--accent); }

.ml-tracks { display: flex; flex-direction: column; gap: 4px; }
.ml-empty { padding: 32px; text-align: center; color: var(--text-muted); font-size: 13px; }

.music-lib-toast {
  position: absolute;
  bottom: 100px; left: 50%;
  transform: translateX(-50%);
  background: var(--popover-bg);
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 13px;
  color: var(--text-2);
}

.music-lib-foot {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 24px;
  align-items: center;
  padding: 12px 24px;
  background: var(--bg);
  border-top: 1px solid var(--popover-bg);
  flex-shrink: 0;
}

.foot-current { display: flex; align-items: center; gap: 14px; min-width: 0; }
.foot-play-btn {
  width: 38px; height: 38px;
  flex-shrink: 0;
  border-radius: 50%;
  border: none;
  background: var(--accent);
  color: var(--text-on-accent);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: background 0.15s;
}
.foot-play-btn:hover { background: var(--accent); }
.foot-loop-btn {
  width: 32px; height: 32px;
  flex-shrink: 0;
  border-radius: 8px;
  border: 1px solid var(--surface-active);
  background: none;
  color: var(--text-2);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.foot-loop-btn:hover { border-color: var(--accent); color: var(--accent); }
.foot-loop-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--text-on-accent);
}
.foot-text { min-width: 0; flex: 1; }
.foot-status { display: flex; align-items: center; gap: 5px; font-size: 9px; letter-spacing: 0.1em; font-weight: 700; color: var(--accent); }
.foot-status-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
.foot-title {
  font-size: 14px; font-weight: 600; color: var(--text-1);
  margin-top: 2px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.foot-progress {
  margin-top: 6px;
  height: 4px;
  border-radius: 2px;
  background: color-mix(in srgb, var(--text-on-accent) 6%, transparent);
  overflow: hidden;
}
.foot-progress--clickable { cursor: pointer; }
.foot-progress--clickable:hover { background: color-mix(in srgb, var(--text-on-accent) 10%, transparent); }
.foot-progress-bar { height: 100%; background: var(--accent); transition: width 0.2s linear; }
.foot-time {
  font-size: 11px; color: var(--text-muted); margin-top: 3px;
  font-variant-numeric: tabular-nums;
}

.foot-cross {
  display: flex; flex-direction: column; align-items: stretch; gap: 8px;
  padding: 0 16px;
  min-width: 320px;
}
.foot-cross-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  background: var(--accent);
  border: none;
  border-radius: 9px;
  color: var(--text-on-accent);
  font: inherit; font-size: 13px; font-weight: 600;
  padding: 9px 18px;
  cursor: pointer;
  align-self: center;
  transition: background 0.15s, opacity 0.15s;
}
.foot-cross-btn:hover:not(:disabled) { background: var(--accent); }
.foot-cross-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.foot-cross-fade {
  display: flex; align-items: center; gap: 10px;
  width: 100%;
  font-size: 10px; color: var(--text-2); letter-spacing: 0.04em;
}
.foot-cross-fade-label { flex-shrink: 0; }
.foot-cross-fade-value {
  flex-shrink: 0;
  font-size: 11px; color: var(--text-2);
  min-width: 38px; text-align: right;
  font-variant-numeric: tabular-nums;
}

.foot-next {
  text-align: right;
  min-width: 0;
}
.foot-next-head {
  display: flex; align-items: center; justify-content: flex-end; gap: 10px;
}
.foot-next-label { font-size: 9px; letter-spacing: 0.1em; font-weight: 700; color: var(--text-2); }
.foot-next-title {
  font-size: 14px; font-weight: 600; color: var(--text-1);
  margin-top: 2px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.foot-next-empty { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
.foot-next-meta { font-size: 11px; color: var(--text-muted); margin-top: 2px; font-variant-numeric: tabular-nums; }
.foot-next-clear {
  background: none; border: none;
  color: var(--text-2);
  font-size: 10px;
  font-family: inherit;
  letter-spacing: 0.04em;
  cursor: pointer; padding: 2px 6px;
  border-radius: 4px;
  transition: color 0.15s, background 0.15s;
}
.foot-next-clear:hover { color: var(--danger); background: color-mix(in srgb, var(--danger) 8%, transparent); }

.album-picker {
  width: 380px;
  max-width: 90%;
  background: var(--popover-bg);
  border: 1px solid var(--border-strong);
  border-radius: 12px;
  padding: 18px 18px 14px;
  box-shadow: 0 12px 40px var(--scrim);
  display: flex; flex-direction: column; gap: 12px;
}
.album-picker-title { font-size: 14px; font-weight: 600; color: var(--text-1); }
.album-picker-list { display: flex; flex-direction: column; gap: 4px; max-height: 320px; overflow-y: auto; }
.album-picker-row {
  display: flex; align-items: center; gap: 10px;
  padding: 7px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px; color: var(--text-2);
  transition: background 0.15s;
}
.album-picker-row:hover { background: color-mix(in srgb, var(--text-on-accent) 4%, transparent); }
.album-picker-row input[type=checkbox] { accent-color: var(--accent); }
.album-picker-dot { width: 8px; height: 8px; border-radius: 50%; }
.album-picker-name { flex: 1; }
.album-picker-empty { font-size: 12px; color: var(--text-muted); padding: 14px; text-align: center; }
.album-picker-actions { display: flex; justify-content: flex-end; }
.album-picker-close {
  background: var(--accent);
  border: none;
  border-radius: 7px;
  color: var(--text-on-accent);
  font: inherit; font-size: 13px; font-weight: 600;
  padding: 7px 16px;
  cursor: pointer;
}
.album-picker-close:hover:not(:disabled) { background: var(--accent); }
.album-picker-close:disabled { opacity: 0.4; cursor: not-allowed; }

.tag-manager-list {
  display: flex; flex-direction: column; gap: 4px;
  max-height: 320px; overflow-y: auto;
}
.tag-manager-row {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 13px; color: var(--text-2);
  transition: background 0.15s;
}
.tag-manager-row:hover { background: color-mix(in srgb, var(--text-on-accent) 4%, transparent); }
.tag-manager-name { flex: 1; }
.tag-manager-input {
  flex: 1; min-width: 0;
  background: color-mix(in srgb, var(--text-on-accent) 5%, transparent);
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  padding: 6px 9px;
  color: var(--text-1);
  font: inherit; font-size: 13px;
  outline: none;
}
.tag-manager-input:focus { border-color: var(--accent); }
.tag-manager-btn {
  width: 26px; height: 26px;
  flex-shrink: 0;
  background: none;
  border: none;
  border-radius: 5px;
  color: var(--text-2);
  font: inherit; font-size: 14px;
  line-height: 1;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s, color 0.15s;
}
.tag-manager-btn:hover { background: color-mix(in srgb, var(--text-on-accent) 6%, transparent); color: var(--text-1); }
.tag-manager-btn--danger:hover { color: var(--danger); background: color-mix(in srgb, var(--danger) 10%, transparent); }

.tag-manager-new {
  display: flex; gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border-strong);
}
.tag-manager-new .album-picker-close { padding: 7px 14px; font-size: 12px; }
</style>
