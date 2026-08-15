<template>
  <AppModal fullscreen :z-index="2200" @close="onClose">
    <div class="music-lib">
        <header class="music-lib-head">
          <h2 class="music-lib-title">Музыкальная библиотека</h2>
          <span class="music-lib-count">{{ musicStore.tracks.length }} треков</span>
          <span class="music-lib-sub">· личная и системная коллекция</span>
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
              <span v-if="album.isSystem" class="sb-album-system" title="Доступен всем, редактирование отключено">системный</span>
              <span class="sb-album-count">{{ album.trackCount }}</span>
            </button>

            <button v-if="!selectedAlbum?.isSystem" class="music-lib-dropzone" :class="{ active: dropActive }"
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
            <div v-else class="music-lib-system-note">
              <span class="music-lib-system-note-title">Системный альбом</span>
              Доступен всем пользователям и защищён от изменений.
            </div>
          </aside>

          <div class="music-lib-main-col">
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
                <a
                  v-if="selectedAlbum.licenseUrl"
                  :href="selectedAlbum.licenseUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                >{{ selectedAlbum.licenseName || 'CC0' }}</a>
                <span v-else>{{ selectedAlbum.licenseName || 'CC0' }}</span>
                <span> · </span>
                <a
                  v-if="selectedAlbum.sourceUrl"
                  :href="selectedAlbum.sourceUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                >{{ selectedAlbum.author || 'источник' }} ↗</a>
                <span v-else>{{ selectedAlbum.author }}</span>
              </span>
              <div class="ml-main-actions" v-if="selectedAlbum && !selectedAlbum.isSystem">
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
                :read-only="t.isSystem"
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

        <AppModalFrame
          v-if="tagPickerTrack"
          :title="`Теги для «${tagPickerTrack.name}»`"
          :z-index="2300"
          @close="tagPickerTrack = null"
        >
          <div class="album-picker">
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
          </div>
          <template #footer>
            <button class="album-picker-close" @click="tagPickerTrack = null">Готово</button>
          </template>
        </AppModalFrame>

        <AppModalFrame v-if="tagManagerOpen" title="Теги" :z-index="2300" @close="tagManagerOpen = false">
          <div class="album-picker">
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
          </div>
          <template #footer>
            <button class="album-picker-close" @click="tagManagerOpen = false">Готово</button>
          </template>
        </AppModalFrame>

        <AppModalFrame
          v-if="albumPickerTrack"
          :title="`Альбомы для «${albumPickerTrack.name}»`"
          :z-index="2300"
          @close="albumPickerTrack = null"
        >
          <div class="album-picker">
            <div class="album-picker-list">
              <label v-for="album in editableAlbums" :key="album.id" class="album-picker-row">
                <input
                  type="checkbox"
                  :checked="(albumPickerTrack.albumIds || []).includes(album.id)"
                  @change="onToggleTrackAlbum(album, $event.target.checked)"
                />
                <span class="album-picker-dot" :style="{ background: album.color || 'var(--accent)' }" />
                <span class="album-picker-name">{{ album.name }}</span>
              </label>
              <div v-if="!editableAlbums.length" class="album-picker-empty">Создайте альбом в сайдбаре</div>
            </div>
          </div>
          <template #footer>
            <button class="album-picker-close" @click="albumPickerTrack = null">Готово</button>
          </template>
        </AppModalFrame>
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
import { reorderByDrop, useSortable } from '@sylvieshare/share-ui'
import { AppModal } from '@sylvieshare/share-ui'
import { AppModalFrame } from '@sylvieshare/share-ui'
import { AppSlider } from '@sylvieshare/share-ui'
import { ConfirmDialog } from '@sylvieshare/share-ui'
import { TextPromptDialog } from '@sylvieshare/share-ui'
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
const editableAlbums = computed(() => musicStore.albums.filter(album => !album.isSystem))

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

const canSort = computed(() => !!selectedAlbumId.value
  && !selectedAlbum.value?.isSystem
  && !searchQuery.value.trim()
  && !activeTagIds.value.length)

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
  if (track.isSystem) return
  textPrompt.value = { kind: 'track', target: track, title: 'Новое название трека', value: track.name }
}
function onDeleteTrack(track) {
  if (track.isSystem) return
  deleteTarget.value = { kind: 'track', target: track, title: 'Удалить трек?', message: `«${track.name}»` }
}

function onChangeAlbums(track) {
  if (track.isSystem) return
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
  if (track.isSystem) return
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
  if (!selectedAlbum.value || selectedAlbum.value.isSystem) return
  textPrompt.value = { kind: 'album-rename', target: selectedAlbum.value, title: 'Новое название альбома', value: selectedAlbum.value.name }
}
function onDeleteAlbum() {
  if (!selectedAlbum.value || selectedAlbum.value.isSystem) return
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

<style scoped src="./styles/MusicLibraryModal.css"></style>
