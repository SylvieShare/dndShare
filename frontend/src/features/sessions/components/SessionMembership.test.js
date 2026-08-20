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

  it('can attach a character in place and excludes characters already in the target session', () => {
    expect(modal).toContain("redirectOnJoin: { type: Boolean, default: true }")
    expect(modal).toContain("emit('joined', char)")
    expect(modal).toContain('if (props.redirectOnJoin)')
    expect(modal).toContain('!== props.sessionUuid')
  })

  it('sends explicit replacement intent to the server', () => {
    expect(api).toContain('replaceExisting = false')
    expect(api).toContain('{ charId, replaceExisting }')
  })
})

describe('sessions empty state', () => {
  it('offers creation and code joining in two action columns for every empty filter', () => {
    expect(sessionsPage).toContain('v-else class="empty-state"')
    expect(sessionsPage).toContain('class="empty-actions"')
    expect(sessionsPage).toContain('Хочу создать сессию')
    expect(sessionsPage).toContain('Хочу присоединиться')
    expect(sessionsPage).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))')
    expect(sessionsPage).toContain('@submit.prevent="handleJoin"')
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
