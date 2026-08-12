import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./DndMobileStatusMenu.vue', import.meta.url)), 'utf8')
const hpSource = readFileSync(fileURLToPath(new URL('./components/DndHpView.vue', import.meta.url)), 'utf8')

describe('mobile HP and status strip', () => {
  it('keeps the status action trigger visible and omits empty indicators', () => {
    expect(source).toContain('v-if="hasActiveSummary"')
    expect(source).toContain('v-if="exhaustionLevel > 0"')
    expect(source).toContain('v-if="inspirationActive"')
    expect(source).toContain('Статусы')
  })

  it('opens a dedicated editor window for every action', () => {
    for (const editor of ['states', 'exhaustion', 'inspiration']) {
      expect(source).toContain(`editorKind === '${editor}'`)
    }
    expect(source.match(/<AppModalFrame/g)).toHaveLength(3)
  })

  it('sizes compact HP by its numbers and prevents flex shrinking', () => {
    expect(hpSource).toMatch(/\.hp-compact \{[^}]*flex: 0 0 auto;[^}]*width: max-content;[^}]*min-width: max-content;/)
    expect(hpSource).toMatch(/\.hp-c-nums \{[^}]*min-width: max-content;[^}]*white-space: nowrap;/)
  })
})
