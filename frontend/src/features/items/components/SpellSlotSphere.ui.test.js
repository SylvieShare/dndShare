import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./SpellSlotSphere.vue', import.meta.url)), 'utf8')

describe('spell slot sphere hover preview', () => {
  it('highlights the continuous range affected by a click', () => {
    expect(source).toContain('.ss-on:not(.ss-ro):hover ~ .ss-on:not(.ss-ro)')
    expect(source).toContain('.ss-off:not(.ss-ro):has(~ .ss-off:not(.ss-ro):hover)')
    expect(source).not.toContain('.ss:hover { transform: scale(1.12); }')
  })
})
