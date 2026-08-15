import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const tab = readFileSync(fileURLToPath(new URL('./ChapterGraphTab.vue', import.meta.url)), 'utf8')

describe('chapter graph action transitions', () => {
  it('uses the shared row-action transition for chapter and edge popovers', () => {
    expect(tab.match(/transition-preset="action-menu"/g)).toHaveLength(2)
    expect(tab).not.toContain('transition="ram-popover"')
  })
})
