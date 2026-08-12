import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import RowActionItem from './RowActionItem.vue'

const source = readFileSync(fileURLToPath(new URL('./RowActionItem.vue', import.meta.url)), 'utf8')

describe('RowActionItem', () => {
  it('compiles the shared action item', () => {
    expect(RowActionItem).toBeTruthy()
  })

  it('provides icons for the standard action vocabulary', () => {
    for (const action of ['use', 'replenish', 'view', 'delete', 'edit', 'create', 'copy', 'copy-link', 'kick', 'revive']) {
      expect(source).toMatch(new RegExp(`['"]?${action}['"]?:`))
    }
  })

  it('accepts a custom icon and keeps every item icon-shaped', () => {
    expect(source).toContain('icon: { type: [Object, Function]')
    expect(source).toContain('<slot name="icon">')
    expect(source).toContain('props.icon || ACTION_ICONS[props.action] || Ellipsis')
    expect(source).toContain('min-height: 36px;')
    expect(source).toContain('font-size: 13px;')
  })

  it('supports the accent tone for primary game actions', () => {
    expect(source).toContain("['default', 'accent', 'warning', 'success', 'info', 'danger']")
    expect(source).toContain('.ram-item--accent { color: var(--accent-soft);')
  })

  it('gives enabled actions a quick press response', () => {
    expect(source).toContain('.ram-item:active:not(:disabled)')
    expect(source).toContain('transform: scale(0.975);')
    expect(source).toContain('.ram-item:active:not(:disabled) .ram-item__icon')
    expect(source).toContain('prefers-reduced-motion: reduce')
  })
})
