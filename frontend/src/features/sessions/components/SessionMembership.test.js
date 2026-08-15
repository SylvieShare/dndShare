import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = relative => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')
const modal = read('./SessionJoinModal.vue')
const invitePage = read('../pages/ViewJoinSession.vue')
const sessionsPage = read('../pages/ViewSessions.vue')
const card = read('./SessionCard.vue')
const toolbar = read('./ChapterGraphToolbar.vue')
const api = read('../../../shared/api/sessionsApi.js')

describe('single session membership', () => {
  it.each([modal, invitePage])('warns before replacing a character session link', source => {
    expect(source).toContain('title="Перенести персонажа?"')
    expect(source).toContain('Старая связь будет удалена.')
    expect(source).toContain('joinChar(char, true)')
    expect(source).toContain('sessionsByChar')
  })

  it('sends explicit replacement intent to the server', () => {
    expect(api).toContain('replaceExisting = false')
    expect(api).toContain('{ charId, replaceExisting }')
  })
})

describe('sessions without a lifecycle status', () => {
  it('keeps only ownership filters and removes session status controls', () => {
    expect(sessionsPage).not.toContain('ACTIVE_STATUSES')
    expect(sessionsPage).not.toContain("key: 'archive'")
    expect(card).not.toContain('status-badge')
    expect(toolbar).not.toContain('SessionStatusMenu')
  })
})
