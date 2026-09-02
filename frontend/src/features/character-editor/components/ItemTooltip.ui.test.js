import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./ItemTooltip.vue', import.meta.url)), 'utf8')

describe('ItemTooltip presentation', () => {
  it('animates its appearance and respects reduced-motion preferences', () => {
    expect(source).toContain('<Transition name="itt-pop" appear>')
    expect(source).toContain('.itt-pop-enter-from')
    expect(source).toContain('@media (prefers-reduced-motion: reduce)')
  })

  it('separates a display title from quieter descriptive content', () => {
    expect(source).toContain("'itt-title--separated': displayDesc || $slots.details")
    expect(source).toContain('font-family: var(--font-display)')
    expect(source).toContain('font-size: 20px')
    expect(source).toContain('.itt-title--separated')
    expect(source).toContain('font-size: 9px')
  })
})
