import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const step = readFileSync(new URL('./StepPersona.vue', import.meta.url), 'utf8')
const media = readFileSync(new URL('../PersonaMediaPicker.vue', import.meta.url), 'utf8')
const storyFields = step.slice(step.indexOf('const storyFields'), step.indexOf('const appearanceDescriptionField'))

describe('persona step composition', () => {
  it('groups identity, character, story and appearance into one visual composition', () => {
    expect(step).toContain('class="identity-card"')
    expect(step).toContain('>Характер</h3>')
    expect(step).toContain('>История</h3>')
    expect(step).toContain('>Облик</h3>')
    expect(step).toContain(':block="appearanceDescriptionField"')
    expect(step).toContain('class="appearance-block"')
    expect(storyFields).not.toContain('person_appearance')
    expect(step).toContain('<Dices')
  })

  it('supports separate portrait and character icon uploads with cropping', () => {
    expect(step).toContain('<PersonaMediaPicker')
    expect(media).toContain('aria-label="Выбрать портрет персонажа"')
    expect(media).toContain('aria-label="Выбрать иконку персонажа"')
    expect(media).toContain('<AvatarCropModal')
    expect(media).toContain("fetch('/api/storage/images'")
    expect(media).toContain("formData.append('purpose', 'character_icon')")
    expect(media).toContain('grid-template-columns: 76px minmax(0, 1fr)')
    expect(media).toContain('grid-template-columns: minmax(0, 1fr)')
  })
})
