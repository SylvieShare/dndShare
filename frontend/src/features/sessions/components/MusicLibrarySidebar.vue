<template>
  <aside class="music-lib-sidebar">
    <header class="music-lib-head">
      <span class="music-lib-eyebrow">БИБЛИОТЕКА</span>
      <div class="music-lib-title-row">
        <h2 class="music-lib-title">Музыка</h2>
        <span class="music-lib-count">{{ personalTrackCount }}</span>
      </div>
      <span class="music-lib-sub">Личная коллекция и системный каталог</span>
    </header>

    <div class="sb-section-title">МОЯ МУЗЫКА <button class="sb-add" @click="$emit('create-album')">+</button></div>
    <AlbumButton :active="selectedAlbumId == null" name="Все треки" :count="personalTrackCount" @click="$emit('select-album', null)" />
    <AlbumButton
      v-for="album in personalAlbums"
      :key="album.id"
      :active="selectedAlbumId === album.id"
      :name="album.name"
      :count="album.trackCount"
      :color="album.color"
      :data-sortable-container="musicAlbumDropGroup(album.id)"
      :drop-target="dragTargetAlbumId === album.id"
      @click="$emit('select-album', album.id)"
    />

    <div v-if="systemAlbums.length" class="sb-section-title sb-section-title--system">СИСТЕМНЫЕ АЛЬБОМЫ</div>
    <AlbumButton
      v-for="album in systemAlbums"
      :key="album.id"
      :active="selectedAlbumId === album.id"
      :name="album.name"
      :count="album.trackCount"
      :color="album.color"
      @click="$emit('select-album', album.id)"
    />

    <button
      v-if="!selectedAlbumIsSystem"
      type="button"
      class="music-lib-dropzone"
      :class="{ active: dropActive }"
      @click="$emit('open-files')"
      @dragenter.prevent="$emit('drag-enter')"
      @dragleave.prevent="$emit('drag-leave')"
      @dragover.prevent
      @drop.prevent="$emit('file-drop', $event)"
    >
      <div class="music-lib-dropzone-icon">＋</div>
      <div>Перетащите файлы<br>или нажмите</div>
      <div class="music-lib-dropzone-sub">.mp3 / .ogg / .flac · до 50 МБ</div>
    </button>
    <div v-else class="music-lib-system-note">
      <span class="music-lib-system-note-title">Системный альбом</span>
      Файлы защищены от изменений. Треки можно добавить в личные альбомы и отметить своими тегами.
    </div>
  </aside>
</template>

<script setup>
import AlbumButton from '@/features/sessions/components/MusicLibrarySidebarAlbum.vue'
import { musicAlbumDropGroup } from '@/features/sessions/composables/useMusicTrackOrganizer'

defineProps({
  personalTrackCount: { type: Number, default: 0 },
  personalAlbums: { type: Array, default: () => [] },
  systemAlbums: { type: Array, default: () => [] },
  selectedAlbumId: { type: Number, default: null },
  selectedAlbumIsSystem: { type: Boolean, default: false },
  dropActive: { type: Boolean, default: false },
  dragTargetAlbumId: { type: Number, default: null },
})

defineEmits(['select-album', 'create-album', 'open-files', 'drag-enter', 'drag-leave', 'file-drop'])
</script>

<style scoped>
.music-lib-sidebar { min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: 4px; overflow-y: auto; padding: 13px 10px 10px; border: 1px solid color-mix(in srgb, var(--border) 88%, transparent); border-radius: 13px; background: color-mix(in srgb, var(--surface) 92%, transparent); box-shadow: 0 10px 30px color-mix(in srgb, var(--bg) 32%, transparent); backdrop-filter: blur(14px) saturate(1.08); }
.music-lib-head { min-height: 68px; display: flex; flex-shrink: 0; flex-direction: column; gap: 2px; padding: 0 5px 12px; border-bottom: 1px solid var(--border); }
.music-lib-eyebrow { color: var(--text-muted); font-size: 8px; font-weight: 800; letter-spacing: 0.12em; }
.music-lib-title-row { display: flex; min-width: 0; align-items: center; gap: 8px; }
.music-lib-title { margin: 0; color: var(--text-1); font-family: var(--font-display); font-size: 20px; font-weight: 700; }
.music-lib-count { min-width: 22px; padding: 3px 6px; border-radius: 999px; background: color-mix(in srgb, var(--accent) 13%, transparent); color: var(--accent-soft); font-size: 8px; font-weight: 800; text-align: center; }
.music-lib-sub { color: var(--text-muted); font-size: 9px; }
.sb-section-title { display: flex; align-items: center; padding: 12px 6px 6px; color: var(--text-muted); font-size: 10px; font-weight: 700; letter-spacing: 0.08em; }
.sb-section-title--system { margin-top: 6px; border-top: 1px solid var(--border); }
.sb-add { width: 31px; height: 31px; margin-left: auto; border: 1px solid color-mix(in srgb, var(--accent) 44%, var(--border)); border-radius: 8px; background: color-mix(in srgb, var(--accent) 10%, transparent); color: var(--accent-soft); font: inherit; font-size: 14px; cursor: pointer; }
.music-lib-dropzone { margin-top: auto; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 18px 14px; border: 1px dashed var(--border-strong); border-radius: 10px; background: none; color: var(--text-2); font-family: inherit; font-size: 12px; text-align: center; cursor: pointer; }
.music-lib-dropzone > * { pointer-events: none; }
.music-lib-dropzone:hover, .music-lib-dropzone.active { border-color: var(--accent); color: var(--accent); background: color-mix(in srgb, var(--accent) 5%, transparent); }
.music-lib-dropzone-icon { font-size: 22px; line-height: 1; }
.music-lib-dropzone-sub { font-size: 10px; }
.music-lib-system-note { margin-top: auto; padding: 14px; border: 1px solid var(--border-strong); border-radius: 10px; color: var(--text-muted); font-size: 11px; line-height: 1.45; }
.music-lib-system-note-title { display: block; margin-bottom: 4px; color: var(--text-2); font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
@media (max-width: 760px) { .music-lib-sidebar { padding-top: 8px; } }
</style>
