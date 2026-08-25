import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./DndHpView.vue', import.meta.url)), 'utf8')

describe('desktop HP view', () => {
  it('places the icon and numbers to the left of the health bar', () => {
    expect(source).toMatch(/<div class="hp-content"[\s\S]*?<div class="hp-main">[\s\S]*?<div class="hp-bar">/)
    expect(source).toMatch(/\.hp-content \{[^}]*display: flex;[^}]*align-items: center;/)
    expect(source).toMatch(/\.hp-bar \{[^}]*flex: 1 1 auto;/)
  })

  it('does not show a health label or hit-die pools in the main tile', () => {
    expect(source).not.toContain('hp-status-badge')
    expect(source).not.toContain('hp-dice-row')
    expect(source).not.toContain('SystemDie')
    expect(source).not.toContain('Кости хитов')
    for (const label of ['Здоров', 'Хорошо', 'Ранен', 'Опасно', 'Критически']) {
      expect(source).not.toContain(label)
    }
  })
})
