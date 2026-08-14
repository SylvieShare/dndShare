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
const centerWorkspaceSource = readFileSync(fileURLToPath(new URL('../components/SessionCenterWorkspace.vue', import.meta.url)), 'utf8')
const encounterSource = readFileSync(fileURLToPath(new URL('../components/EncounterTab.vue', import.meta.url)), 'utf8')
const encounterRowSource = readFileSync(fileURLToPath(new URL('../components/EncounterRow.vue', import.meta.url)), 'utf8')
const sceneSource = readFileSync(fileURLToPath(new URL('../components/SceneTab.vue', import.meta.url)), 'utf8')
const encounterStylesSource = readFileSync(fileURLToPath(new URL('../components/styles/EncounterTab.css', import.meta.url)), 'utf8')
const sceneStylesSource = readFileSync(fileURLToPath(new URL('../components/styles/SceneTab.css', import.meta.url)), 'utf8')
const dicePopupSource = readFileSync(fileURLToPath(new URL('../../../shared/ui/DiceRollPopup.vue', import.meta.url)), 'utf8')
const baseTileSource = readFileSync(fileURLToPath(new URL('../../../shared/ui/BaseTile.vue', import.meta.url)), 'utf8')

describe('ViewSession participant rail', () => {
  it('compiles the page component', () => {
    expect(ViewSession).toBeTruthy()
  })

  it('keeps player actions in the heading menu instead of a bottom invite tile', () => {
    expect(source).toContain('<div class="players-actions">')
    expect(source).toContain('<RowActionMenu>')
    expect(source).toContain('class="players-actions-trigger"')
    expect(source).toContain('<RowActionItem action="create"')
    expect(source).toContain('<RowActionItem action="copy"')
    expect(source).toContain('<RowActionItem action="copy-link"')
    expect(source).not.toContain('invite-section')
  })

  it('uses the chapter canvas as the full workspace with tools floating above it', () => {
    expect(source).toContain('class="campaign-workspace"')
    expect(source).toContain('class="campaign-graph"')
    expect(source).toContain('workspace-dock workspace-dock--left')
    expect(source).toContain('workspace-dock workspace-dock--right')
    expect(styles).toContain('.campaign-workspace {')
    expect(styles).toContain('position: absolute;')
    expect(styles).toContain('--chapter-safe-left: 288px;')
    expect(styles).toContain('--chapter-safe-right: 336px;')
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

  it('places the event log below the music panel', () => {
    expect(source.indexOf('<MusicPanel'))
      .toBeLessThan(source.indexOf('<SessionEventsPanel'))
  })

  it('uses the opened character sheet as the actor for session dice rolls', () => {
    expect(source).toContain('watch(sheetUuid, actorUuid => {')
    expect(source).toContain('sessionEventsStore.setActor(actorUuid, sessionUuid)')
  })

  it('animates displayed rolls on every viewport and cleans up popup timers', () => {
    expect(DiceRollPopup).toBeTruthy()
    expect(dicePopupSource).not.toContain("'(max-width: 640px)'")
    expect(dicePopupSource).toContain("'(prefers-reduced-motion: reduce)'")
    expect(dicePopupSource).toContain('displayedRoll(entry, i, ri, r)')
    expect(dicePopupSource).toContain('displayedTotal(entry)')
    expect(dicePopupSource).toContain("p.color || entry.color || 'var(--accent)'")
    expect(dicePopupSource).toContain('isTotalRolling(entry.id)')
    expect(dicePopupSource).toContain("entry.outcome && !isRolling(entry.id)")
    expect(dicePopupSource).toContain('dice-pop-crit-settle')
    expect(dicePopupSource).toContain('clearEntryAnimation')
    expect(dicePopupSource).not.toContain('part.rolls[rollIndex] =')
  })

  it('centers wrapped dice operators against the 38px dice', () => {
    expect(dicePopupSource).toMatch(/\.dice-pop-rolls-plus\s*\{[^}]*display:\s*inline-flex;[^}]*align-items:\s*center;[^}]*height:\s*38px;/s)
    expect(dicePopupSource).toMatch(/\.dice-pop-roll-wrap\s*\{[^}]*vertical-align:\s*middle;/s)
  })

  it('opens combat and chapter scenes inside a locked transparent canvas workspace', () => {
    expect(source).toContain('<SessionCenterWorkspace')
    expect(source).toContain(':locked="!!workspaceMode"')
    expect(source).toContain(':spotlight-chapter-id="workspaceChapter?.id ?? null"')
    expect(source).not.toContain('v-if="combatOpen"')
    expect(source).not.toContain('v-if="sceneWorkspaceChapter"')
    expect(centerWorkspaceSource).toContain("'--session-workspace-header-left': props.chapter ? '252px' : '0px'")
    expect(centerWorkspaceSource).toContain('bottom: 0;')
    expect(centerWorkspaceSource).not.toContain('.session-center-workspace::after')
    expect(centerWorkspaceSource).not.toContain('backdrop-filter: blur(6px)')
    expect(encounterStylesSource).not.toContain('mask-image:')
    expect(sceneStylesSource).not.toContain('mask-image:')
    expect(centerWorkspaceSource).not.toContain('<BaseTile')
    expect(encounterSource).toContain("'enc-wrap--workspace': workspace")
    expect(sceneSource).toContain("'scene-tab--workspace': workspace")
    expect(source).toContain('@scene-count="chapterGraph.setSceneCount"')
  })

  it('uses per-participant actions without bulk selection controls', () => {
    expect(source).toContain('@view="openParticipant"')
    expect(source).toContain('@color="setParticipantColor"')
    expect(source).toContain('@kick="requestKickParticipant"')
    expect(source).not.toContain('Выбрать игроков для действия')
    expect(source).not.toContain('selectionMode')
  })

  it('saves a session-local participant color and marks player tiles in both rails', () => {
    expect(source).toContain('await updateParticipantColor(sessionUuid, charId, color)')
    expect(source).toContain('{ ...participant, color: color || null }')
    expect(encounterRowSource).toContain(':mark-color="playerColor"')
    expect(encounterRowSource).toContain('enc.participantColor(props.combatant.charId)')
    expect(baseTileSource).toContain('clip-path: polygon(30% 0, 100% 0, 100% 100%, 0 100%);')
    expect(baseTileSource).not.toContain('transform: rotate(45deg);')
  })

  it('asks for confirmation before kicking a participant', () => {
    expect(source).toContain('title="Выгнать игрока?"')
    expect(source).toContain('@kick="requestKickParticipant"')
    expect(source).toContain('@confirm="confirmKickParticipant"')
    expect(source).toContain('if (await kickParticipant(charId)) pendingKick.value = null')
    expect(selectionSource).toContain('return true')
    expect(selectionSource).toContain('return false')
  })

  it('keeps a failed kick visible and only removes a participant after success', () => {
    expect(source).toContain('role="alert"')
    expect(selectionSource.indexOf('await apiKick(sessionUuid, charId)'))
      .toBeLessThan(selectionSource.indexOf('participants.value = participants.value.filter'))
    expect(selectionSource).toContain("kickError.value = 'Не удалось выгнать участника'")
    expect(selectionSource).not.toContain('.catch(() => {})')
  })
})
