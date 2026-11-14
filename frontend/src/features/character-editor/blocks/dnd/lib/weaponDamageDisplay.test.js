import { describe, expect, it } from 'vitest'
import { weaponDamageDisplay } from './weaponDamageDisplay'
import { evaluateDiceParts, parseDiceExpression } from '@/shared/lib/dice'

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
  it('places the common die after d8/d10 once, including a die identical to the two-handed base', () => {
    const [group] = weaponDamageDisplay([
      { source: 'Оружие', expression: '1d8+1d10' }, { source: 'Магия оружия', expression: '1' },
    ], [
      { source: 'Оружие', expression: '1d10+1d10' }, { source: 'Магия оружия', expression: '1' },
    ])
    expect(group.columns.map(column => column.source)).toEqual(['Оружие', 'Магия оружия'])
    expect(group.columns[0].variants.map(terms => terms.map(term => term.sides))).toEqual([[8], [10]])
    expect(group.columns[0].shared.map(term => term.sides)).toEqual([10])
    expect(group.columns[1].variants).toHaveLength(1)
  })
  it('matches repeated addends one for one and preserves different quantities and signs', () => {
    const column = (left, right) => weaponDamageDisplay([{ source: 'Оружие', expression: left }], [{ source: 'Оружие', expression: right }])[0].columns[0]
    const repeated = column('1d8+1d6+1d6', '1d10+1d6')
    expect(repeated.variants.map(terms => terms.map(term => term.sides))).toEqual([[8, 6], [10]])
    expect(repeated.shared.map(term => term.sides)).toEqual([6])
    expect(column('1d8+1d6', '1d10+2d6').shared).toEqual([])
    expect(column('1d8-1d6', '1d10+1d6').shared).toEqual([])
    const negative = column('1d8-2', '1d10-2')
    expect(negative.operator).toBe('+')
    expect(negative.shared).toMatchObject([{ sign: '-', kind: 'flat', value: 2 }])
  })
  it('never moves a die between damage types or source identities', () => {
    const groups = weaponDamageDisplay([
      { source: 'Оружие', expression: '1d8{Рубящий}+1d6{Огонь}' },
      { source: 'Эффект', expression: '1d6{Рубящий}' },
    ], [
      { source: 'Оружие', expression: '1d10{Рубящий}+1d6{Огонь}' },
      { source: 'Эффект', expression: '1d6{Рубящий}' },
    ])
    expect(groups.map(group => group.type)).toEqual(['Рубящий', 'Огонь'])
    expect(groups[0].columns.map(column => column.source)).toEqual(['Оружие', 'Эффект'])
    expect(groups[0].columns[0].shared).toEqual([])
    expect(groups[1].columns[0].variants).toHaveLength(1)
  })
  it('keeps multiplied expressions intact instead of factoring across their operators', () => {
    const column = weaponDamageDisplay([{ expression: '1d8*2+1d6' }], [{ expression: '1d10*2+1d6' }])[0].columns[0]
    expect(column.shared).toEqual([])
    expect(column.variants.map(terms => terms.map(term => term.sign))).toEqual([['+', '×', '+'], ['+', '×', '+']])
  })
  it.each([
    ['1d8+1d10', '1d10+1d10'], ['1d8+2d6-3', '1d10+2d6-3'],
    ['1d8-2', '1d10-2'], ['-1d8', '-1d10'], ['1d8+1d6+1d6', '1d10+1d6'],
    ['1d8+1d6', '1d6+1d8'], ['1d8*2+1d6', '1d10*2+1d6'],
  ])('preserves each displayed grip total and leaves input rows untouched: %s / %s', (left, right) => {
    const rows = [{ source: 'Оружие', expression: left }], alternatives = [{ source: 'Оружие', expression: right }]
    const original = structuredClone({ rows, alternatives })
    const groups = weaponDamageDisplay(rows, alternatives)
    const maximum = term => term.kind === 'dice' ? term.n * term.sides : term.value
    for (const [index, expression] of [left, right].entries()) {
      const displayed = groups.flatMap(group => group.columns).reduce((total, column) => {
        const terms = [...column.variants[Math.min(index, column.variants.length - 1)], ...column.shared]
        const normalized = terms.map(term => ({ ...term, operator: term.sign === '×' ? '*' : term.sign }))
        return total + (column.operator === '−' ? -1 : 1) * evaluateDiceParts(normalized, maximum).total
      }, 0)
      expect(displayed).toBe(evaluateDiceParts(parseDiceExpression(expression), maximum).total)
    }
    expect({ rows, alternatives }).toEqual(original)
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
