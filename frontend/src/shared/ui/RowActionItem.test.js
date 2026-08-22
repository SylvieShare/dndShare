import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import RowActionItem from './RowActionItem.vue'

const source = readFileSync(fileURLToPath(new URL('./RowActionItem.vue', import.meta.url)), 'utf8')

describe('RowActionItem', () => {
  it('compiles the DnD icon adapter', () => {
    expect(RowActionItem).toBeTruthy()
  })

  it('provides icons for the standard action vocabulary', () => {
    for (const action of ['use', 'replenish', 'view', 'delete', 'edit', 'create', 'copy', 'copy-link', 'kick', 'revive', 'attack', 'damage', 'critical', 'feature-damage', 'feature-critical']) {
      expect(source).toMatch(new RegExp(`['"]?${action}['"]?:`))
    }
  })

  it('accepts a custom icon and delegates presentation to share-ui', () => {
    expect(source).toContain('icon: { type: [Object, Function]')
    expect(source).toContain('<slot name="icon" />')
    expect(source).toContain('props.icon || ACTION_ICONS[props.action] || Ellipsis')
    expect(source).toContain("import { ActionMenuItem } from '@sylvieshare/share-ui'")
    expect(source).toContain('<ActionMenuItem')
  })

  it('keeps the public tone vocabulary', () => {
    expect(source).toContain("['default', 'accent', 'warning', 'success', 'info', 'danger']")
  })
})
