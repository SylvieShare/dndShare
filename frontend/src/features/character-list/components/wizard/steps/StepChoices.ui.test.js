import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./StepChoices.vue', import.meta.url)), 'utf8')
const wizard = readFileSync(fileURLToPath(new URL('../../../composables/useDndCreateWizard.js', import.meta.url)), 'utf8')

describe('feature choice presentation', () => {
  it('reuses the class skill picker for skill-based abilities', () => {
    expect(source).toContain('<SkillPicker')
    expect(source).toContain('v-if="isSkillChoice(fc.choice)"')
    expect(source).toContain(':title="fc.name"')
    expect(source).toContain('@toggle="(id) => toggleChoice(fc.id, id, Number(fc.choice.count) || 1)"')
  })

  it('reuses spell tiles for ability-owned spell choices', () => {
    expect(source).toContain('v-else-if="isSpellChoice(fc.choice)"')
    expect(source).toContain('<SpellSelectTile')
    expect(source).toContain(':spell="opt.item"')
    expect(source).toContain('@details="viewId = opt.value"')
    expect(source).toContain('<ItemViewModal')
    expect(source).toContain('.step--compact .spell-list { grid-template-columns: 1fr; }')
    expect(wizard).toContain('item,')
  })
})
