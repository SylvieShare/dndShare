import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import SessionTopBar from './SessionTopBar.vue'

const source = readFileSync(fileURLToPath(new URL('./SessionTopBar.vue', import.meta.url)), 'utf8')

describe('SessionTopBar hierarchy', () => {
  it('compiles the top bar component', () => {
    expect(SessionTopBar).toBeTruthy()
  })

  it('keeps title then chapter hierarchy and has no sessions back-link', () => {
    expect(source).not.toContain('К сессиям')
    expect(source).not.toContain('class="back-link"')
    expect(source.indexOf('class="session-info"')).toBeLessThan(source.indexOf('class="chapter-wrap"'))
    expect(source).toMatch(/\.session-title\s*\{[\s\S]*?font-size: 21px;/)
  })

  it('shows the status menu only to the DM and keeps chapter controls wired', () => {
    expect(source).toContain('<SessionStatusMenu')
    expect(source).toContain('v-if="isDm"')
    expect(source).toContain('@status-change="$emit(\'status-change\', $event)"')
    expect(source).toContain('@click="toggleChapterMenu"')
    expect(source).toContain('v-model:open="chapterOpen"')
  })
})
