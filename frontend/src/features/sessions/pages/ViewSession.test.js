import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import ViewSession from './ViewSession.vue'

const source = readFileSync(fileURLToPath(new URL('./ViewSession.vue', import.meta.url)), 'utf8')
const selectionSource = readFileSync(fileURLToPath(new URL('../composables/useSessionSelection.js', import.meta.url)), 'utf8')

describe('ViewSession participant rail', () => {
  it('compiles the page component', () => {
    expect(ViewSession).toBeTruthy()
  })

  it('uses BaseTile for the complete invite section', () => {
    expect(source).toContain('<BaseTile class="invite-section">')
    expect(source).toContain('</BaseTile>')
  })

  it('uses per-participant actions without bulk selection controls', () => {
    expect(source).toContain('@view="openParticipant"')
    expect(source).toContain('@kick="kickParticipant"')
    expect(source).not.toContain('Выбрать игроков для действия')
    expect(source).not.toContain('selectionMode')
  })

  it('keeps a failed kick visible and only removes a participant after success', () => {
    expect(source).toContain('role="alert"')
    expect(selectionSource.indexOf('await apiKick(sessionUuid, charId)'))
      .toBeLessThan(selectionSource.indexOf('participants.value = participants.value.filter'))
    expect(selectionSource).toContain("kickError.value = 'Не удалось выгнать участника'")
    expect(selectionSource).not.toContain('.catch(() => {})')
  })
})
