import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import DiceRollPopup from '../../../shared/ui/DiceRollPopup.vue'
import ViewSession from './ViewSession.vue'

const source = readFileSync(fileURLToPath(new URL('./ViewSession.vue', import.meta.url)), 'utf8')
const styles = readFileSync(fileURLToPath(new URL('./styles/ViewSession.css', import.meta.url)), 'utf8')
const selectionSource = readFileSync(fileURLToPath(new URL('../composables/useSessionSelection.js', import.meta.url)), 'utf8')
const workspaceSource = readFileSync(fileURLToPath(new URL('../composables/useSessionWorkspace.js', import.meta.url)), 'utf8')
const dicePanelSource = readFileSync(fileURLToPath(new URL('../components/DicePanel.vue', import.meta.url)), 'utf8')
const musicPanelSource = readFileSync(fileURLToPath(new URL('../components/MusicPanel.vue', import.meta.url)), 'utf8')
const centerWorkspaceSource = readFileSync(fileURLToPath(new URL('../components/SessionCenterWorkspace.vue', import.meta.url)), 'utf8')
const encounterSource = readFileSync(fileURLToPath(new URL('../components/EncounterTab.vue', import.meta.url)), 'utf8')
const encounterComposableSource = readFileSync(fileURLToPath(new URL('../composables/useEncounter.js', import.meta.url)), 'utf8')
const graveyardSource = readFileSync(fileURLToPath(new URL('../components/EncounterGraveyardMenu.vue', import.meta.url)), 'utf8')
const encounterRowSource = readFileSync(fileURLToPath(new URL('../components/EncounterRow.vue', import.meta.url)), 'utf8')
const encounterAvatarSource = readFileSync(fileURLToPath(new URL('../components/EncounterAvatar.vue', import.meta.url)), 'utf8')
const encounterControlsSource = readFileSync(fileURLToPath(new URL('../components/EncounterCombatControls.vue', import.meta.url)), 'utf8')
const encounterMarkerSource = readFileSync(fileURLToPath(new URL('../components/EncounterMarkerMenu.vue', import.meta.url)), 'utf8')
const encounterMenuSource = readFileSync(fileURLToPath(new URL('../components/EncounterRowMenu.vue', import.meta.url)), 'utf8')
const encounterFlowSource = readFileSync(fileURLToPath(new URL('../composables/useEncounterFlow.js', import.meta.url)), 'utf8')
const encounterOrderSource = readFileSync(fileURLToPath(new URL('../components/EncounterOrderMarker.vue', import.meta.url)), 'utf8')
const sceneSource = readFileSync(fileURLToPath(new URL('../components/SceneTab.vue', import.meta.url)), 'utf8')
const encounterStylesSource = readFileSync(fileURLToPath(new URL('../components/styles/EncounterTab.css', import.meta.url)), 'utf8')
const sceneStylesSource = readFileSync(fileURLToPath(new URL('../components/styles/SceneTab.css', import.meta.url)), 'utf8')
const dicePopupSource = readFileSync(fileURLToPath(new URL('../../../shared/ui/DiceRollPopup.vue', import.meta.url)), 'utf8')
const colorTicksSource = readFileSync(fileURLToPath(new URL('../components/ParticipantColorTicks.vue', import.meta.url)), 'utf8')

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

  it('restores the open combat or chapter scenes workspace after a page reload', () => {
    expect(source).toContain('useSessionWorkspace({ sessionUuid, chapterGraph })')
    expect(source).toContain('await restoreWorkspace()')
    expect(workspaceSource).toContain("const WORKSPACE_MODES = new Set(['combat', 'scenes'])")
    expect(workspaceSource).toContain('localStorage.setItem(sessionWorkspaceKey(sessionUuid)')
    expect(workspaceSource).toContain('async function restoreWorkspace()')
    expect(workspaceSource).toContain('clearSavedWorkspace()')
  })

  it('reuses one encounter in the combat workspace and the expanding player rail', () => {
    expect(source).toContain('const encounter = reactive(useEncounter({')
    expect(source).toContain(':encounter="encounter"')
    expect(source).toContain(':combat-mode="workspaceMode === \'combat\'"')
    expect(styles).toContain('.campaign-workspace--combat .workspace-dock--left')
    expect(encounterSource).not.toContain('ЗАПАС ИГРОКОВ')
    expect(encounterSource).not.toContain('КЛАДБИЩЕ')
    expect(encounterSource).toContain('<EncounterGraveyardMenu')
    expect(graveyardSource).toContain('aria-label="Погибшие существа"')
    expect(graveyardSource).toContain('Удалить всех')
  })

  it('keeps players in the combat scene and numbers every initiative row', () => {
    expect(encounterSource).toContain("const combatItems = computed(() => enc.sortable.displayItems('combat'))")
    expect(encounterSource).toContain(':order="idx + 1"')
    expect(encounterRowSource).toContain('<EncounterOrderMarker')
    expect(encounterOrderSource).toContain('class="enc-row-order"')
    expect(encounterOrderSource).toContain("String(props.order).padStart(2, '0')")
  })

  it('uses shared combat stats, larger portraits and editable NPC letter markers', () => {
    expect(encounterRowSource).toContain('<EncounterCombatControls')
    expect(encounterRowSource).toContain('<EncounterMarkerMenu v-if="isNpc"')
    expect(encounterRowSource.indexOf('<EncounterMarkerMenu v-if="isNpc"')).toBeLessThan(encounterRowSource.indexOf('class="enc-name"'))
    expect(encounterRowSource).toContain('v-if="isNpc"\n          ref="badgeEl"')
    expect(encounterRowSource).not.toContain('.badge--pc')
    expect(encounterControlsSource).toContain('aria-label="Инициатива"')
    expect(encounterControlsSource).toContain('<Shield')
    expect(encounterAvatarSource).toContain("width: 62px;")
    expect(encounterAvatarSource).toContain("width: 72px;")
    expect(encounterAvatarSource).not.toContain('enc-avatar-letter')
    expect(encounterMarkerSource).toContain('v-for="letter in enc.ENCOUNTER_LETTERS"')
    expect(encounterMarkerSource).toContain('<ColorPresetPicker')
  })

  it('opens row actions from the tile and keeps concrete controls independent', () => {
    expect(encounterRowSource).toContain('@click="onRowClick"')
    expect(encounterRowSource).toContain('ref="rowMenuRef"')
    expect(encounterRowSource).toContain('enc.sortable.shouldSuppressClick()')
    expect(encounterRowSource).toContain('event.target?.closest?.(DRAG_IGNORE)')
    expect(encounterMenuSource).toContain('defineExpose({ toggle })')
    expect(encounterMenuSource).toContain('>Состояния</RowActionItem>')
    expect(encounterMenuSource).toContain('>В запас</RowActionItem>')
    expect(encounterMenuSource).toContain('const canDelete = computed(() => isNpc.value)')
    expect(encounterMenuSource).not.toContain('ColorPresetPicker')
    expect(encounterFlowSource).toContain('function sendToReserve(c)')
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
    expect(encounterRowSource).toContain('<ParticipantColorTicks v-if="playerColor" :color="playerColor" />')
    expect(encounterRowSource).toContain('enc.participantColor(props.combatant.charId)')
    expect(encounterRowSource).toContain(':strip="!!rowAccentColor"')
    expect(encounterRowSource).toContain(":color=\"rowAccentColor || 'var(--section-color)'\"")
    expect(encounterComposableSource).toContain("if (c.type === 'player') return participantColor(c.charId) || null")
    expect(encounterComposableSource).toContain('return c.iconColor || null')
    expect(colorTicksSource).toContain('class="participant-color-tick"')
    expect(colorTicksSource).toContain('width: 5px;')
    expect(colorTicksSource).toContain('height: 16px;')
    expect(colorTicksSource).toContain('margin-left: 3px;')
    expect(colorTicksSource).toContain('transform: translateY(-10px);')
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
