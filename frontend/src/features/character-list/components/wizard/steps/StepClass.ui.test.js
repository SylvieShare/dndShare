import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./StepClass.vue', import.meta.url)), 'utf8')

describe('class step hierarchy', () => {
  it('uses the shared illustrated selection stage', () => {
    expect(source).toContain('<IllustratedChoiceStage')
    expect(source).toContain('back-text="К выбору класса"')
  })

  it('uses covers rather than icons for classes and subclasses', () => {
    expect(source).toContain(':image-url="c.coverImageUrl || \'\'"')
    expect(source).toContain(':image-url="s.coverImageUrl || \'\'"')
    expect(source).not.toContain('iconImageUrl')
  })

  it('separates every dependent class choice and omits the duplicate result', () => {
    expect(source).toContain('class="choice-stack"')
    expect(source).toContain('<StepClassEquipment v-if="classEquipmentProfile" class="choice-block"')
    expect(source).toContain('<StepSkills v-if="skillOptions.length" class="choice-block"')
    expect(source).toContain('<StepChoices v-if="classFeatureChoices.length" scope="class" class="choice-block"')
    expect(source).not.toContain('ChoiceResult')
  })
})
