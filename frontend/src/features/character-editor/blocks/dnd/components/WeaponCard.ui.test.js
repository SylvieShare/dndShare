import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./WeaponCard.vue', import.meta.url)), 'utf8')

describe('weapon card actions', () => {
  it('opens all weapon operations through the row action menu', () => {
    expect(source).toContain('<RowActionMenu')
    expect(source).toContain('>Бросок на атаку</RowActionItem>')
    expect(source).toContain('>Бросок на урон</RowActionItem>')
    expect(source).toContain('>Бросок на критический урон</RowActionItem>')
    expect(source).toContain('weaponDamageActions.length')
    expect(source).toContain('<RowActionSeparator')
    expect(source).toContain('>Открыть описание</RowActionItem>')
    expect(source).toContain('>Редактировать</RowActionItem>')
    expect(source).toContain('>Переместить в вещи</RowActionItem>')
    expect(source).toContain('>Удалить</RowActionItem>')
  })

  it('keeps weapon values display-only outside the action menu', () => {
    expect(source).not.toContain('@roll-attack')
    expect(source).not.toContain('@roll-damage')
    expect(source).not.toContain('@roll-critical')
  })

  it('does not open a handbook entry directly from the weapon name', () => {
    expect(source).not.toContain('@name-click')
    expect(source).not.toContain('function onNameClick')
  })
})
