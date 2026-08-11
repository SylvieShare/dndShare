import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import ViewSession from './ViewSession.vue'

const source = readFileSync(fileURLToPath(new URL('./ViewSession.vue', import.meta.url)), 'utf8')
const styles = readFileSync(fileURLToPath(new URL('./styles/ViewSession.css', import.meta.url)), 'utf8')
const selectionSource = readFileSync(fileURLToPath(new URL('../composables/useSessionSelection.js', import.meta.url)), 'utf8')

describe('ViewSession participant rail', () => {
  it('compiles the page component', () => {
    expect(ViewSession).toBeTruthy()
  })

  it('keeps player actions in the heading menu instead of a bottom invite tile', () => {
    expect(source).toContain('<div class="players-actions">')
    expect(source).toContain('<RowActionMenu>')
    expect(source).toContain('class="players-actions-trigger"')
    expect(source).toContain('>Создать персонажа</button>')
    expect(source).toContain('>Скопировать код приглашения</button>')
    expect(source).toContain('>Скопировать ссылку приглашения</button>')
    expect(source).not.toContain('invite-section')
  })

  it('keeps both combat and chapter canvases transparent without changing the scene tile', () => {
    expect(source).toContain("'tab-content--canvas': activeTab === 'combat' || activeTab === 'chapters'")
    expect(source).toContain('class="tab-content"')
    expect(styles).toContain('.tab-content.tab-content--canvas {\n  background: transparent;\n  border: 0;\n  box-shadow: none;\n}')
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
