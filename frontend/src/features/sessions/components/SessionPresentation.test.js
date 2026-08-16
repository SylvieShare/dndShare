import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { useSessionMaterials } from '@/features/sessions/composables/useSessionMaterials'

const read = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
const toolbar = read('./ChapterGraphToolbar.vue')
const control = read('./SessionPresentationControl.vue')
const workspace = read('./SessionMaterialsWorkspace.vue')
const sceneEditor = read('./SceneEditorModal.vue')
const blockEditor = read('./SceneBlockEditorModal.vue')
const blockMenu = read('./SceneBlockMenus.vue')
const publicScreen = read('../pages/ViewEncounterScreen.vue')
const publicStyles = read('../pages/styles/ViewEncounterScreen.css')
const materialEditor = read('./MaterialEditorModal.vue')
const encounter = read('./EncounterTab.vue')
const libraryShell = read('./SessionLibraryWorkspace.vue')
const presentationState = read('../composables/useSessionPresentation.js')
const displayMusic = read('../composables/useDisplayMusic.js')
const musicPanel = read('./MusicPanel.vue')
const sessionPage = read('../pages/ViewSession.vue')
const sessionsApi = read('../../../shared/api/sessionsApi.js')

describe('session presentation workspace', () => {
  it('keeps materials as a primary DM workspace and a contextual header control', () => {
    expect(toolbar).toContain("{ key: 'materials', label: 'Материалы'")
    expect(toolbar).toContain('<SessionPresentationControl')
    expect(control).toContain('Материалы сессии')
    expect(control).toContain('Затемнить')
    expect(control).toContain('Эффект на экране игроков')
    expect(workspace).toContain('Транслировать')
  })

  it('keeps scenario editing independent from the player display', () => {
    expect(sceneEditor).not.toContain('СЦЕНА ПОКАЗА')
    expect(sceneEditor).not.toContain('presentationMaterialId')
    expect(control).not.toContain('Запустить сцену')
    expect(presentationState).not.toContain('startScene')
  })

  it('adds image and material blocks that broadcast existing materials', () => {
    expect(blockEditor).toContain("blockType.value === 'image'")
    expect(blockEditor).toContain('draft.materialId')
    expect(blockMenu).toContain("block.type === 'image'")
    expect(blockEditor).toContain("blockType.value === 'material'")
    expect(blockEditor).toContain('<WorldRelationPickerModal')
    expect(blockMenu).toContain("block.type === 'image' || block.type === 'material'")
    expect(blockMenu).toContain('Транслировать')
  })

  it('uses one public screen for blackout, full-screen materials and combat', () => {
    expect(publicScreen).toContain('ЭКРАН ПОКАЗА')
    expect(publicScreen).toContain("presentation.mode === 'material'")
    expect(publicScreen).not.toContain("presentation.mode === 'scene'")
    expect(publicScreen).toContain("presentation.mode === 'combat'")
    expect(publicScreen).not.toContain('Обновляется')
    expect(publicStyles).toContain('.encounter-screen__blackout')
    expect(publicStyles).toContain('.encounter-screen--material')
    expect(publicStyles).toContain('object-fit: contain')
    expect(publicStyles).toContain('.presentation-effect')
    expect(presentationState).toContain("const clear = () => save({ mode: 'idle', visible: true")
  })

  it('uses SSE with resilient polling fallback and remote music playback', () => {
    expect(control).toContain('Транслировать музыку')
    expect(control).toContain('setBroadcastMusic')
    expect(publicScreen).toContain('new EventSource')
    expect(publicScreen).toContain('scheduleFallback')
    expect(publicScreen).toContain('CONTROL_SYNC_INTERVAL_MS')
    expect(publicScreen).toContain('getPublicDisplayMusic')
    expect(displayMusic).toContain('runCrossfade')
    expect(displayMusic).toContain('blocked.value = true')
    expect(publicScreen).toContain('Включить звук')
    expect(musicPanel).toContain('НА ЭКРАНЕ')
  })

  it('shows the live number of connected display screens to the DM', () => {
    expect(control).toContain("'chapter-tool-btn--connected': hasConnectedScreens")
    expect(control).toContain('presentation.connectedScreens.value')
    expect(control).toContain('Нет подключённых экранов')
    expect(control).toContain('Получают обновления в реальном времени')
    expect(presentationState).toContain('getSessionPresentationConnections')
    expect(presentationState).toContain('setConnectedScreens')
    expect(sessionPage).toContain('presentation.setConnectedScreens(update.connectedScreens)')
    expect(sessionPage).toContain('presentation.loadConnections()')
    expect(sessionPage).not.toContain('startConnectionPolling')
    expect(sessionsApi).toContain('/presentation-connections')
  })

  it('supports typed materials and styled notes on the shared library layout', () => {
    expect(materialEditor).toContain('MATERIAL_TYPES')
    expect(materialEditor).toContain('NOTE_STYLES')
    expect(materialEditor).toContain('/api/storage/videos')
    expect(workspace).toContain('SessionLibraryWorkspace')
    expect(libraryShell).toContain('session-world-workspace')
    expect(publicScreen).toContain("presentationMaterial?.kind === 'video'")
    expect(publicScreen).toContain("presentationMaterial?.kind === 'note'")
    expect(publicStyles).toContain('.presentation-note--parchment')
    expect(workspace).not.toContain(':cover-url="[\'image\', \'map\'].includes(selected.kind)')
    expect(workspace).toContain('<template #visual><component :is="materialType(selected.kind).icon"')
  })

  it('uses reusable relation editing for material contexts and keeps screen launch in the header control', () => {
		expect(materialEditor).toContain('<UniversalRelationEditor')
		expect(materialEditor).toContain('source-type="material"')
		expect(materialEditor).not.toContain('draft.chapterLinks')
		expect(materialEditor).not.toContain('draft.sceneLinks')
		expect(sceneEditor).not.toContain('UniversalRelationEditor')
    expect(materialEditor).not.toContain('label="Доступен"')
    expect(encounter).not.toContain('Открыть экран показа')
    expect(control).toContain('Открыть экран показа')
  })
})

describe('material visibility', () => {
	it('makes every session material available from every scenario', () => {
    const library = useSessionMaterials({ sessionUuid: 'session' })
    library.materials.value = [
			{ id: 1, relations: [] },
			{ id: 2, relations: [{ type: 'npc', id: 7 }] },
			{ id: 3, scenarioUsages: [{ sceneId: 20, blockCount: 1 }] },
			{ id: 4, scenarioUsages: [{ sceneId: 21, blockCount: 1 }] },
    ]
		expect(library.availableFor(20).map(item => item.id)).toEqual([1, 2, 3, 4])
  })
})
