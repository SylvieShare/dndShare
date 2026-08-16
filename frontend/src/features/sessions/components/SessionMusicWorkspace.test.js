import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import SessionMusicWorkspace from './SessionMusicWorkspace.vue'

const workspaceSource = readFileSync(fileURLToPath(new URL('./SessionMusicWorkspace.vue', import.meta.url)), 'utf8')
const rowSource = readFileSync(fileURLToPath(new URL('./MusicTrackRow.vue', import.meta.url)), 'utf8')

describe('session music workspace', () => {
  it('compiles the library as a central workspace with system albums', () => {
    expect(SessionMusicWorkspace).toBeTruthy()
    expect(workspaceSource).toContain('class="session-music-workspace"')
    expect(workspaceSource).not.toContain('<AppModal fullscreen')
    expect(workspaceSource).not.toContain('music-lib-close')
    expect(workspaceSource).toContain('личная и системная коллекция')
    expect(workspaceSource).toContain('selectedAlbum.sourceUrl')
    expect(workspaceSource).toContain('selectedAlbum.licenseName')
    expect(workspaceSource).toContain('selectedAlbum.licenseUrl')
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
