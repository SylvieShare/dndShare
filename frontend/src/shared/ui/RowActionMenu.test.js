import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import RowActionMenu from './RowActionMenu.vue'

const source = readFileSync(fileURLToPath(new URL('./RowActionMenu.vue', import.meta.url)), 'utf8')

describe('RowActionMenu motion', () => {
  it('compiles the shared action menu', () => {
    expect(RowActionMenu).toBeTruthy()
  })

  it('animates both entering and leaving from the trigger origin', () => {
    expect(source).toContain('<Transition name="ram-popover">')
    expect(source).toContain('.ram-popover-enter-active')
    expect(source).toContain('.ram-popover-leave-active')
    expect(source).toContain('transform-origin: var(--ram-origin-x, 100%) var(--ram-origin-y, 0);')
  })

  it('respects reduced-motion preferences', () => {
    expect(source).toContain('@media (prefers-reduced-motion: reduce)')
    expect(source).toContain('.ram-popover-enter-active, .ram-popover-leave-active { transition: none; }')
  })

  it('exposes programmatic controls for full-row action triggers', () => {
    expect(source).toContain('defineExpose({ open, close, toggle })')
  })
})
