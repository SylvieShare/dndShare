import { describe, expect, it } from 'vitest'
import { weaponDamageDisplay } from './weaponDamageDisplay'

describe('weapon damage source display', () => {
  const sources = [
    { source: 'Оружие', expression: '1d6{Колющий}' },
    { source: 'Сила', expression: '1' },
    { source: 'Ярость', expression: '2' },
  ]
  it('keeps distinct flat sources and shares their inherited damage type', () => {
    const groups = weaponDamageDisplay(sources)
    expect(groups).toHaveLength(1)
    expect(groups[0].type).toBe('Колющий')
    expect(groups[0].columns.map(column => column.source)).toEqual(['Оружие', 'Сила', 'Ярость'])
    expect(groups[0].columns[1].variants[0][0].value).toBe(1)
    expect(groups[0].columns[2].variants[0][0].value).toBe(2)
  })
  it('shows alternative grip dice without doubling shared modifiers', () => {
    const groups = weaponDamageDisplay(sources, [{ source: 'Оружие', expression: '1d8{Колющий}' }, ...sources.slice(1)])
    expect(groups[0].columns[0].variants.map(terms => terms[0].sides)).toEqual([6, 8])
    expect(groups[0].columns.slice(1).map(column => column.variants.length)).toEqual([1, 1])
  })
  it('groups equal types once, including mixed-type weapon damage', () => {
    const groups = weaponDamageDisplay([...sources, { source: 'Оружие', expression: '1d4{Огонь}' }, { source: 'Пламя', expression: '2{Огонь}' }])
    expect(groups.map(group => group.type)).toEqual(['Колющий', 'Огонь'])
    expect(groups[1].columns.map(column => column.source)).toEqual(['Оружие', 'Пламя'])
  })
  it('preserves negative contributions and a fixed base value', () => {
    const groups = weaponDamageDisplay([{ source: 'Оружие', expression: '1' }, { source: 'Сила', expression: '-2' }], [], { type: 'Дробящий' })
    expect(groups[0].type).toBe('Дробящий')
    expect(groups[0].columns[0].variants[0][0].value).toBe(1)
    expect(groups[0].columns[1].operator).toBe('−')
    expect(groups[0].columns[1].variants[0][0].value).toBe(2)
    expect(weaponDamageDisplay([{ source: 'Оружие', expression: '0' }])[0].columns[0].variants[0][0].value).toBe(0)
  })
  it('does not discard addition or multiplication within a source', () => {
    const group = weaponDamageDisplay([{ source: 'Особый урон', expression: '2d6*2-1' }])[0]
    expect(group.columns[0].variants[0].map(term => term.sign)).toEqual(['+', '×', '-'])
  })
  it('keeps the base roll identity separate from bonus labels and across mode captions', () => {
    for (const source of ['Бросок', 'Преимущество', 'Помеха']) {
      const [group] = weaponDamageDisplay([
        { key: 'attack-roll', roll: true, source, expression: '2d20' },
        { source: 'attack-roll', expression: '1d20' },
      ])
      expect(group.columns.map(column => column.key)).toEqual(['key:attack-roll', 'source:attack-roll'])
      expect(group.columns.map(column => column.roll)).toEqual([true, false])
    }
  })
})
