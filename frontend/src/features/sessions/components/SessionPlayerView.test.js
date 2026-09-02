import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import SessionPlayerView from './SessionPlayerView.vue'

const source = readFileSync(fileURLToPath(new URL('./SessionPlayerView.vue', import.meta.url)), 'utf8')
const responsiveStyles = readFileSync(fileURLToPath(new URL('./styles/SessionPlayerViewResponsive.css', import.meta.url)), 'utf8')
const sessionPage = readFileSync(fileURLToPath(new URL('../pages/ViewSession.vue', import.meta.url)), 'utf8')
const sessionCard = readFileSync(fileURLToPath(new URL('./SessionCard.vue', import.meta.url)), 'utf8')

describe('player session view', () => {
  it('compiles as a separate role-specific page composition', () => {
    expect(SessionPlayerView).toBeTruthy()
    expect(sessionPage).toContain('v-else-if="session && !isDm"')
    expect(sessionPage).toContain('<SessionPlayerView')
  })

  it('presents the current chapter and responsive party roster', () => {
    expect(source).toContain('class="current-chapter"')
    expect(source).toContain('Текущая глава')
    expect(source).toContain('class="party-list"')
    expect(source).toContain('participant.publicVisible === true')
    expect(source).toContain('isMine(participant) || participant.publicVisible')
    expect(responsiveStyles).toContain('@media (max-width: 920px)')
  })

  it('opens the role-aware session page from every session card', () => {
    expect(sessionCard).toContain("router.push('/sessions/' + props.session.uuid)")
    expect(sessionCard).not.toContain("router.push({ path: '/char/' + props.session.myCharUuid")
  })
})
