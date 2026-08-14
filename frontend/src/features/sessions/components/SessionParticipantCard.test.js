import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import SessionParticipantCard from './SessionParticipantCard.vue'

const source = readFileSync(fileURLToPath(new URL('./SessionParticipantCard.vue', import.meta.url)), 'utf8')
const combatControlsSource = readFileSync(fileURLToPath(new URL('./EncounterCombatControls.vue', import.meta.url)), 'utf8')

describe('SessionParticipantCard actions', () => {
  it('compiles the participant component', () => {
    expect(SessionParticipantCard).toBeTruthy()
  })

  it('opens a shared row action menu from the participant BaseTile', () => {
    expect(source).toContain('<RowActionMenu>')
    expect(source).toContain('<template #trigger>')
    expect(source).toContain(':style="participantAvatarStyle"')
    expect(source).toContain("borderColor: props.participant.color || 'transparent'")
  })

  it('makes the action trigger and participant tile span the whole rail', () => {
    expect(source).toContain('.p-card-menu {\n  width: 100%;\n}')
    expect(source).toContain('.p-card-menu :deep(.ram-custom-trigger) {\n  display: flex;\n  width: 100%;\n}')
    expect(source).toContain('.p-card {\n  width: 100%;\n  box-sizing: border-box;')
  })

  it('offers view to everyone and DM-only color and kick actions', () => {
    expect(source).toContain('<RowActionItem action="view"')
    expect(source).toContain("{{ colorPending ? 'Сохранение…' : 'Назначить цвет' }}")
    expect(source).toContain('<RowActionSubmenu v-if="isDm" label="Цвет игрока"')
    expect(source).toContain('<ColorPresetPicker')
    expect(source).toContain('@update:model-value="color => assignColor(color, closeColor)"')
    expect(source).toMatch(/v-if="isDm"[\s\S]*?action="kick"[\s\S]*?>\{\{ kickPending \? 'Исключение…' : 'Выгнать' \}\}<\/RowActionItem>/)
    expect(source).toContain("defineEmits(['view', 'kick', 'color', 'update:combat-selected', 'update:initiative'])")
  })

  it('adds battle selection, initiative and armor class to the expanded player tile', () => {
    expect(source).toContain('v-if="combatMode"')
    expect(source).toContain('<EncounterCombatControls')
    expect(combatControlsSource).toContain('<EncCheckbox')
    expect(combatControlsSource).toContain('aria-label="Инициатива"')
    expect(source).toContain("const armorClass = computed(() => pvAc(props.participant))")
    expect(source).toContain("'p-card--current': combatMode && combatCurrent")
  })
})
