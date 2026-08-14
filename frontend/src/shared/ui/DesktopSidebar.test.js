import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const sidebarSource = readFileSync(fileURLToPath(new URL('./DesktopSidebar.vue', import.meta.url)), 'utf8')

describe('desktop sidebar icons', () => {
  it('uses a document for sessions and people for characters', () => {
    expect(sidebarSource).toMatch(/sessions:\s*ScrollText/)
    expect(sidebarSource).toMatch(/characters:\s*Users/)
  })
})
