import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const avatarSource = readFileSync(fileURLToPath(new URL('./AvatarBlock.vue', import.meta.url)), 'utf8')
const identitySource = readFileSync(fileURLToPath(new URL('../dnd/DndCharIdentity.vue', import.meta.url)), 'utf8')
const characterIconSource = readFileSync(fileURLToPath(new URL('../dnd/DndCharacterIcon.vue', import.meta.url)), 'utf8')
const cropSource = readFileSync(fileURLToPath(new URL('../../components/AvatarCropModal.vue', import.meta.url)), 'utf8')
const viewSource = readFileSync(fileURLToPath(new URL('../../pages/ViewCharacter.vue', import.meta.url)), 'utf8')

describe('character portrait UI', () => {
  it('keeps portrait upload and cropping in the Personality portrait editor', () => {
    expect(avatarSource).toContain('Загрузить изображение')
    expect(avatarSource).toContain('Кадрировать')
    expect(avatarSource).toContain('Очистить')
    expect(avatarSource).toContain('<AvatarCropModal')
    expect(avatarSource).toContain('/api/storage/images/${')
    expect(identitySource).not.toContain('<AvatarCropModal')
  })

  it('opens direct upload and clear actions from the compact header icon', () => {
    expect(characterIconSource).toContain('Изменить иконку персонажа')
    expect(characterIconSource).toContain('>Загрузить</button>')
    expect(characterIconSource).toContain('>Очистить</button>')
    expect(characterIconSource).toContain('uploadCharacterIcon(file)')
    expect(characterIconSource).toContain('clearCharacterIcon()')
    expect(characterIconSource).not.toContain('AvatarCropModal')
  })

  it('uses the character icon in the sheet summary and falls back to the portrait', () => {
    expect(characterIconSource).toContain('charCtx.iconImageUrl || props.values?.ava?.url')
    expect(characterIconSource).toMatch(/\.dci-icon \{[\s\S]*?width: 88px;[\s\S]*?height: 88px;/)
    expect(characterIconSource).toContain('background: none')
    expect(characterIconSource).toContain('border: 0')
    expect(characterIconSource).toContain('margin-top: 15px')
  })

  it('renders portrait action popovers above the embedded session sheet', () => {
    for (const source of [avatarSource, characterIconSource]) {
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
