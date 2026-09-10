import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./WeaponCard.vue', import.meta.url)), 'utf8')

describe('weapon card actions', () => {
  it('opens all weapon operations through the row action menu', () => {
    expect(source).toContain('<RowActionMenu')
    expect(source).toContain('>Бросок на атаку</RowActionItem>')
    expect(source).toContain('<DamageRollOptions')
    expect(source).toContain(':actions="weaponDamageActions"')
    expect(source).toContain(':versatile="hasTwoHandedDamage"')
    expect(source).toContain('<RowActionSeparator')
    expect(source).toContain('>Открыть описание</RowActionItem>')
    expect(source).toContain('>Редактировать</RowActionItem>')
    expect(source).toContain('>Переместить в вещи</RowActionItem>')
    expect(source).toContain('>Удалить</RowActionItem>')
    expect(source).toContain('action="attack"')
    expect(source).not.toContain('action="damage"')
    expect(source).not.toContain('action="critical"')
    expect(source).not.toContain('action="feature-damage"')
    expect(source).not.toContain('action="feature-critical"')
    expect(source).toContain("'action-menu-source--open': menuOpen")
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
