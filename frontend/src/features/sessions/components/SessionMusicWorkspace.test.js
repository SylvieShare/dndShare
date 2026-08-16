import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import SessionMusicWorkspace from './SessionMusicWorkspace.vue'

const workspaceSource = readFileSync(fileURLToPath(new URL('./SessionMusicWorkspace.vue', import.meta.url)), 'utf8')
const workspaceStyles = readFileSync(fileURLToPath(new URL('./styles/SessionMusicWorkspace.css', import.meta.url)), 'utf8')
const rowSource = readFileSync(fileURLToPath(new URL('./MusicTrackRow.vue', import.meta.url)), 'utf8')

describe('session music workspace', () => {
  it('compiles the library as a central workspace with system albums', () => {
    expect(SessionMusicWorkspace).toBeTruthy()
    expect(workspaceSource).toContain('class="session-music-workspace"')
    expect(workspaceSource).not.toContain('<AppModal fullscreen')
    expect(workspaceSource).not.toContain('music-lib-close')
    expect(workspaceSource).toContain('Личная и системная коллекция')
    expect(workspaceSource).toContain('selectedAlbum.sourceUrl')
    expect(workspaceSource).toContain('selectedAlbum.licenseName')
    expect(workspaceSource).toContain('selectedAlbum.licenseUrl')
  })

  it('uses the same split-panel canvas treatment as the session catalogues', () => {
    expect(workspaceSource).not.toContain('class="music-lib"')
    expect(workspaceSource).toContain('<aside class="music-lib-sidebar">')
    expect(workspaceSource).toContain('<div class="music-lib-main-col">')
    expect(workspaceStyles).toContain('grid-template-columns: 310px minmax(0, 1fr)')
    expect(workspaceStyles).toContain('background: color-mix(in srgb, var(--surface) 92%, transparent)')
  })

  it('keeps system albums and tracks read-only in every editing entry point', () => {
    expect(workspaceSource).toContain('selectedAlbum && !selectedAlbum.isSystem')
    expect(workspaceSource).toContain(':read-only="t.isSystem"')
    expect(workspaceSource).toContain('musicStore.albums.filter(album => !album.isSystem)')
    expect(workspaceSource).toContain('!selectedAlbum.value?.isSystem')
    expect(workspaceSource.match(/if \(track\.isSystem\) return/g)).toHaveLength(4)
    expect(rowSource).toContain('v-if="!readOnly" class="music-row-menu-wrap"')
    expect(rowSource).toContain('Системный трек доступен всем и защищён от изменений')
  })
})
