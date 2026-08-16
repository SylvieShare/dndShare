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

describe('session presentation workspace', () => {
  it('keeps materials as a primary DM workspace and a contextual header control', () => {
    expect(toolbar).toContain("{ key: 'materials', label: 'Материалы'")
    expect(toolbar).toContain('<SessionPresentationControl')
    expect(control).toContain('Материалы в контексте')
    expect(control).toContain('Затемнить')
    expect(control).toContain('Эффект на экране игроков')
    expect(workspace).toContain('Транслировать')
  })

  it('stores a complete reusable scene preset', () => {
    expect(sceneEditor).toContain('presentationMaterialId')
    expect(sceneEditor).toContain('presentationTrackId')
    expect(sceneEditor).toContain('presentationCrossfadeSec')
    expect(sceneEditor).toContain('presentationEffect')
    expect(sceneEditor).toContain('presentationTransition')
  })

  it('adds image blocks that broadcast an existing material', () => {
    expect(blockEditor).toContain("blockType === 'image'")
    expect(blockEditor).toContain('draft.materialId')
    expect(blockMenu).toContain("block.type === 'image'")
    expect(blockMenu).toContain('Транслировать')
  })

  it('uses one public screen for blackout, materials, scenes and combat', () => {
    expect(publicScreen).toContain('ЭКРАН ПОКАЗА')
    expect(publicScreen).toContain("presentation.mode === 'material'")
    expect(publicScreen).toContain("presentation.mode === 'scene'")
    expect(publicScreen).toContain("presentation.mode === 'combat'")
    expect(publicStyles).toContain('.encounter-screen__blackout')
    expect(publicStyles).toContain('.presentation-effect')
  })
})

describe('material visibility', () => {
  it('inherits session and chapter resources into a scenario without leaking sibling resources', () => {
    const library = useSessionMaterials({ sessionUuid: 'session' })
    library.materials.value = [
      { id: 1, scope: 'session' },
      { id: 2, scope: 'chapter', chapterId: 10 },
      { id: 3, scope: 'chapter', chapterId: 11 },
      { id: 4, scope: 'scene', chapterId: 10, sceneId: 20 },
      { id: 5, scope: 'scene', chapterId: 10, sceneId: 21 },
    ]
    expect(library.availableFor(10, 20).map(item => item.id)).toEqual([1, 2, 4])
  })
})
