import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import DiceRollPopup from '../../../shared/ui/DiceRollPopup.vue'
import ViewSession from './ViewSession.vue'

const source = readFileSync(fileURLToPath(new URL('./ViewSession.vue', import.meta.url)), 'utf8')
const styles = readFileSync(fileURLToPath(new URL('./styles/ViewSession.css', import.meta.url)), 'utf8')
const selectionSource = readFileSync(fileURLToPath(new URL('../composables/useSessionSelection.js', import.meta.url)), 'utf8')
const dicePanelSource = readFileSync(fileURLToPath(new URL('../components/DicePanel.vue', import.meta.url)), 'utf8')
const musicPanelSource = readFileSync(fileURLToPath(new URL('../components/MusicPanel.vue', import.meta.url)), 'utf8')
const dicePopupSource = readFileSync(fileURLToPath(new URL('../../../shared/ui/DiceRollPopup.vue', import.meta.url)), 'utf8')

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

  it('uses the chapter canvas as the full workspace with tools floating above it', () => {
    expect(source).toContain('class="campaign-workspace"')
    expect(source).toContain('class="campaign-graph"')
    expect(source).toContain('workspace-dock workspace-dock--left')
    expect(source).toContain('workspace-dock workspace-dock--right')
    expect(styles).toContain('.campaign-workspace {')
    expect(styles).toContain('position: absolute;')
    expect(styles).toContain('--chapter-safe-left: 276px;')
    expect(source).not.toContain('<SlidingTabs')
    expect(source).not.toContain('<SessionTopBar')
  })

  it('keeps session dice purple and lets both right-dock tools collapse independently', () => {
    expect(dicePanelSource).toContain('color="var(--accent)"')
    expect(dicePanelSource).toContain("const collapsed = ref(false)")
    expect(dicePanelSource).toContain("aria-label=\"collapsed ? 'Развернуть кубики' : 'Свернуть кубики'\"")
    expect(musicPanelSource).toContain("const collapsed = ref(false)")
    expect(musicPanelSource).toContain("aria-label=\"collapsed ? 'Развернуть музыку' : 'Свернуть музыку'\"")
  })

  it('animates only displayed mobile rolls and cleans up popup timers', () => {
    expect(DiceRollPopup).toBeTruthy()
    expect(dicePopupSource).toContain("'(max-width: 640px)'")
    expect(dicePopupSource).toContain("'(prefers-reduced-motion: reduce)'")
    expect(dicePopupSource).toContain('displayedRoll(entry, i, ri, r)')
    expect(dicePopupSource).toContain('clearEntryAnimation')
    expect(dicePopupSource).not.toContain('part.rolls[rollIndex] =')
  })

  it('opens combat and chapter scenes as fullscreen contextual workspaces', () => {
    expect(source).toContain('v-if="combatOpen"')
    expect(source).toContain('v-if="sceneWorkspaceChapter"')
    expect(source.match(/fullscreen/g)?.length).toBeGreaterThanOrEqual(2)
    expect(source).toContain('<SceneTab\n          contextual')
    expect(source).toContain('@scene-count="chapterGraph.setSceneCount"')
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
