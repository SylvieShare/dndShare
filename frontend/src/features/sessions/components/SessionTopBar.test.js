import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import SessionTopBar from './SessionTopBar.vue'

const source = readFileSync(fileURLToPath(new URL('./SessionTopBar.vue', import.meta.url)), 'utf8')

describe('SessionTopBar hierarchy', () => {
  it('compiles the top bar component', () => {
    expect(SessionTopBar).toBeTruthy()
  })

  it('starts with the larger session name and has no sessions back-link', () => {
    expect(source).not.toContain('К сессиям')
    expect(source).not.toContain('class="back-link"')
    expect(source.indexOf('class="session-info"')).toBeLessThan(source.indexOf('class="status-wrap"'))
    expect(source).toMatch(/\.session-title\s*\{[\s\S]*?font-size: 21px;/)
  })

  it('keeps status and chapter controls wired', () => {
    expect(source).toContain('v-model:open="statusOpen"')
    expect(source).toContain('@click="setStatus(opt.key)"')
    expect(source).toContain('@click="toggleChapterMenu"')
    expect(source).toContain('v-model:open="chapterOpen"')
  })
})
