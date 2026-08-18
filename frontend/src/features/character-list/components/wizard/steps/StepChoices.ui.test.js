import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./StepChoices.vue', import.meta.url)), 'utf8')

describe('feature choice presentation', () => {
  it('reuses the class skill picker for skill-based abilities', () => {
    expect(source).toContain('<SkillPicker')
    expect(source).toContain('v-if="isSkillChoice(fc.choice)"')
    expect(source).toContain(':title="fc.name"')
    expect(source).toContain('@toggle="(id) => toggleChoice(fc.id, id, Number(fc.choice.count) || 1)"')
  })
})
