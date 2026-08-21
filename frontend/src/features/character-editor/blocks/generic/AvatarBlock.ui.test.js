import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const avatarSource = readFileSync(fileURLToPath(new URL('./AvatarBlock.vue', import.meta.url)), 'utf8')
const identitySource = readFileSync(fileURLToPath(new URL('../dnd/DndCharIdentity.vue', import.meta.url)), 'utf8')
const cropSource = readFileSync(fileURLToPath(new URL('../../components/AvatarCropModal.vue', import.meta.url)), 'utf8')
const viewSource = readFileSync(fileURLToPath(new URL('../../pages/ViewCharacter.vue', import.meta.url)), 'utf8')

describe('character portrait UI', () => {
  it('opens upload, crop and clear actions from both portrait editors', () => {
    for (const source of [avatarSource, identitySource]) {
      expect(source).toContain('Загрузить изображение')
      expect(source).toContain('Кадрировать')
      expect(source).toContain('Очистить')
      expect(source).toContain('<AvatarCropModal')
      expect(source).toContain('/api/storage/images/${')
      expect(source).toContain('Загрузить иконку')
      expect(source).toContain('uploadCharacterIcon')
    }
  })

  it('uploads the list and session icon directly without opening the crop modal', () => {
    for (const source of [avatarSource, identitySource]) {
      expect(source).toContain('if (file) uploadIcon(file)')
      expect(source).not.toContain("setCropSource(file, file.name || 'character-icon.webp'")
      expect(source).not.toContain("setAvaCropSource(file, 'icon')")
    }
  })

  it('renders portrait action popovers above the embedded session sheet', () => {
    for (const source of [avatarSource, identitySource]) {
      expect(source).toContain(':z-index="3200"')
    }
  })

  it('renders a draggable crop workspace and exports WebP', () => {
    expect(cropSource).toContain('@pointerdown="startDrag"')
    expect(cropSource).toContain("canvas.toBlob")
    expect(cropSource).toContain("'image/webp'")
  })

  it('records browser snapshots after sheet changes without a global undo handler', () => {
    expect(viewSource).toContain('recordCharacterSnapshot(uuid, data.value)')
    expect(viewSource).not.toContain('onUndoKeydown')
  })
})
