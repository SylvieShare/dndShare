import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

function source(name) {
  return readFileSync(fileURLToPath(new URL(`./${name}.vue`, import.meta.url)), 'utf8')
}

describe('handbook detail visual hierarchy', () => {
  it.each([
    ['ArmorDetailContent', ['Описание', 'Правила ношения']],
    ['ItemDetailContent', ['Описание', 'Характеристики']],
    ['AbilityDetailContent', ['Описание', 'Использование']],
    ['SpellDetailContent', ['Описание заклинания']],
    ['FeatDetailContent', ['Даёт персонажу', 'Выбор при получении', 'Описание']],
    ['WeaponDetailContent', ['Урон', 'Свойства', 'Описание']],
    ['StatusEffectDetailContent', ['Кратко', 'Описание', 'Механика']],
  ])('uses illustrated shared sections in %s', (component, labels) => {
    const componentSource = source(component)
    expect(componentSource).toContain("import DetailSection from '@/shared/ui/DetailSection.vue'")
    for (const label of labels) {
      expect(componentSource).toContain(`label="${label}"`)
    }
    expect(componentSource).toContain('<template #icon>')
  })

  it('keeps combat sections semantically distinct', () => {
    expect(source('WeaponDetailContent')).toContain('label="Урон" tone="combat"')
    expect(source('EnemyDetailContent')).toContain('label="Действия" tone="combat"')
    expect(source('StatusEffectDetailContent')).toContain('label="Механика" tone="combat"')
  })

  it('renders structured equipment-pack contents as item references', () => {
    const componentSource = source('ItemDetailContent')
    expect(componentSource).toContain('label="Содержимое набора"')
    expect(componentSource).toContain('<ItemReferenceRow')
    expect(componentSource).toContain('entry?.item_id')
    expect(componentSource).toContain('<ItemViewModal')
  })
})
