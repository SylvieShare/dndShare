import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./LayoutInnerTabs.vue', import.meta.url)), 'utf8')

describe('inner tabs layout', () => {
  it('keeps tab headings flush with the main character column', () => {
    expect(source).toMatch(/\.inner-tabs \{[\s\S]*?padding: 0;/)
    expect(source).toMatch(/\.inner-tabs :deep\(\.sliding-tabs\) \{[\s\S]*?padding-inline: 0;/)
  })
})
