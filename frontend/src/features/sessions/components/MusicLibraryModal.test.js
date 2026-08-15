import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import MusicLibraryModal from './MusicLibraryModal.vue'

const modalSource = readFileSync(fileURLToPath(new URL('./MusicLibraryModal.vue', import.meta.url)), 'utf8')
const rowSource = readFileSync(fileURLToPath(new URL('./MusicTrackRow.vue', import.meta.url)), 'utf8')

describe('MusicLibraryModal system music', () => {
  it('compiles the library with system albums', () => {
    expect(MusicLibraryModal).toBeTruthy()
    expect(modalSource).toContain('личная и системная коллекция')
    expect(modalSource).toContain('selectedAlbum.sourceUrl')
    expect(modalSource).toContain('selectedAlbum.licenseName')
    expect(modalSource).toContain('selectedAlbum.licenseUrl')
  })

  it('keeps system albums and tracks read-only in every editing entry point', () => {
    expect(modalSource).toContain('selectedAlbum && !selectedAlbum.isSystem')
    expect(modalSource).toContain(':read-only="t.isSystem"')
    expect(modalSource).toContain('musicStore.albums.filter(album => !album.isSystem)')
    expect(modalSource).toContain('!selectedAlbum.value?.isSystem')
    expect(modalSource.match(/if \(track\.isSystem\) return/g)).toHaveLength(4)
    expect(rowSource).toContain('v-if="!readOnly" class="music-row-menu-wrap"')
    expect(rowSource).toContain('Системный трек доступен всем и защищён от изменений')
  })
})
