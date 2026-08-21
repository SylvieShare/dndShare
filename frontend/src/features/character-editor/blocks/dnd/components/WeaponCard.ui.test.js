import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./WeaponCard.vue', import.meta.url)), 'utf8')

describe('weapon card actions', () => {
  it('opens all weapon operations through the row action menu', () => {
    expect(source).toContain('<RowActionMenu')
    expect(source).toContain('>Открыть описание</RowActionItem>')
    expect(source).toContain('>Редактировать</RowActionItem>')
    expect(source).toContain('>Переместить в вещи</RowActionItem>')
    expect(source).toContain('>Удалить</RowActionItem>')
  })

  it('does not open a handbook entry directly from the weapon name', () => {
    expect(source).not.toContain('@name-click')
    expect(source).not.toContain('function onNameClick')
  })
})
