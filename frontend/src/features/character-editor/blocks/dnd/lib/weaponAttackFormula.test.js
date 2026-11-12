import { expect, test } from 'vitest'
import { weaponAttackFormula } from './weaponAttackFormula'
import { weaponDamageDisplay } from './weaponDamageDisplay'

test('advantage and disadvantage retain two d20 while excluded bonuses stay out of the preview', () => {
  for (const [mode, source] of [['advantage', 'Преимущество'], ['disadvantage', 'Помеха']]) {
    const rows = weaponAttackFormula({ mode, parts: [{ source: 'Сила', expression: '-2' }] }, [
      { key: 'bless', source_label: 'Благословение', formula: '1d4' },
      { key: 'excluded', source_label: 'Исключено', formula: '1d6' },
    ], ['excluded'])
    const [group] = weaponDamageDisplay(rows, [], { color: 'var(--accent-soft)' })
    expect(group.columns.map(column => column.source)).toEqual([source, 'Сила', 'Благословение'])
    expect(group.columns[0].variants[0]).toMatchObject([{ n: 2, sides: 20 }])
    expect(group.columns[1].operator).toBe('−')
    expect(group.columns[2].variants[0]).toMatchObject([{ n: 1, sides: 4 }])
  }
})
