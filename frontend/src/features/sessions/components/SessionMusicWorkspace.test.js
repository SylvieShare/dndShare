import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import SessionMusicWorkspace from './SessionMusicWorkspace.vue'

function source(relativePath) {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

const workspaceSource = source('./SessionMusicWorkspace.vue')
const workspaceStyles = source('./styles/SessionMusicWorkspace.css')
const sidebarSource = source('./MusicLibrarySidebar.vue')
const rowSource = source('./MusicTrackRow.vue')
const organizerSource = source('../composables/useMusicTrackOrganizer.js')

describe('session music workspace', () => {
  it('keeps personal and system catalogues separate', () => {
    expect(SessionMusicWorkspace).toBeTruthy()
    expect(workspaceSource).toContain('musicStore.tracks.filter(track => !track.isSystem)')
    expect(workspaceSource).toContain('musicStore.albums.filter(album => album.isSystem)')
    expect(workspaceSource).toContain('const base = selectedAlbumId.value ? musicStore.tracks : personalTracks.value')
    expect(sidebarSource).toContain('МОЯ МУЗЫКА')
    expect(sidebarSource).toContain('СИСТЕМНЫЕ АЛЬБОМЫ')
    expect(workspaceSource).toContain('selectedAlbum.sourceUrl')
    expect(workspaceSource).toContain('selectedAlbum.licenseUrl')
  })

  it('uses the split-panel canvas treatment without an embedded library window', () => {
    expect(workspaceSource).toContain('class="session-music-workspace"')
    expect(workspaceSource).toContain('<MusicLibrarySidebar')
    expect(workspaceSource).toContain('<div class="music-lib-main-col">')
    expect(workspaceSource).not.toContain('<AppModal fullscreen')
    expect(workspaceStyles).toContain('grid-template-columns: 310px minmax(0, 1fr)')
  })

  it('supports range selection, bulk actions, and whole-row album drag', () => {
    expect(workspaceSource).toContain('organizer.selectedTracks.value.length')
    expect(workspaceSource).toContain('openBulkAlbums')
    expect(workspaceSource).toContain('openBulkTags')
    expect(rowSource).toContain('@pointerdown="onPointerDown"')
    expect(rowSource).toContain('@pointerup="onSelect"')
    expect(rowSource).not.toContain('music-row-drag')
    expect(organizerSource).toContain('event.shiftKey')
    expect(sidebarSource).toContain(':data-sortable-container="musicAlbumDropGroup(album.id)"')
  })

  it('allows user organization of system tracks while protecting their files', () => {
    expect(workspaceSource).toContain('function onChangeAlbums(track)')
    expect(workspaceSource).toContain('function onChangeTags(track)')
    expect(rowSource).toContain('<RowActionMenu')
    expect(rowSource).toContain('Изменить альбомы')
    expect(rowSource).toContain('v-if="!system" action="edit"')
    expect(rowSource).toContain('v-if="!system" action="delete"')
    expect(rowSource).not.toContain('music-row-menu-pop')
  })
})
