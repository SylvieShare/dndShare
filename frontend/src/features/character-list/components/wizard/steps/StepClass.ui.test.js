import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./StepClass.vue', import.meta.url)), 'utf8')

describe('class step hierarchy', () => {
  it('keeps the selected class visible while the catalogue reloads', () => {
    expect(source).toContain(':loading="loading && !classes.length && !state.charClass"')
    expect(source).toContain(':empty="!loading && !classes.length && !state.charClass"')
  })

  it('uses the shared illustrated selection stage', () => {
    expect(source).toContain('<IllustratedChoiceStage')
    expect(source).toContain('back-text="К выбору класса"')
  })

  it('keeps class covers and gives archetypes their own icon-led cards', () => {
    expect(source).toContain(':image-url="c.coverImageUrl || \'\'"')
    expect(source).toContain('<SubclassSelectTile')
    expect(source).toContain(':item="s"')
    expect(source).toContain(':description="subclassSummaryFor(s).description"')
    expect(source).toContain(':benefits="subclassSummaryFor(s).benefits"')
  })

  it('separates every dependent class choice and omits the duplicate result', () => {
    expect(source).toContain('class="choice-stack"')
    expect(source).toContain('<StepClassEquipment v-if="classEquipmentProfile" class="choice-block"')
    expect(source).toContain('<StepSkills v-if="skillOptions.length" class="choice-block"')
    expect(source).toContain('<StepToolProficiencies v-if="classToolProficiencyOptions.length" class="choice-block"')
    expect(source).toContain('<StepChoices v-if="classFeatureChoices.length" scope="class" class="choice-block"')
    expect(source).not.toContain('ChoiceResult')
  })
})
