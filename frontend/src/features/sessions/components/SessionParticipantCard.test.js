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

  it('reduces a participant to a titled avatar while the player rail is compact', () => {
    expect(source).toContain("'p-card--compact': compact")
    expect(source).toContain(':title="compact ? displayName : undefined"')
    expect(source).toContain('compact: { type: Boolean, default: false }')
    expect(source).toContain('.p-card--compact { height: 48px; gap: 0; padding: 6px; justify-content: center; }')
    expect(source).toContain('.p-card--compact .p-combat-controls { margin-left: -112px; }')
    expect(source).toContain('.p-card--compact .p-info { flex: 0 0 0; overflow: hidden; opacity: 0;')
  })

  it('offers view to everyone and DM-only color and kick actions', () => {
    expect(source).toContain('<RowActionItem action="view"')
    expect(source).toContain('>Открыть лист</RowActionItem>')
    expect(source).not.toContain('>Просмотреть</RowActionItem>')
    expect(source).toContain("{{ colorPending ? 'Сохранение…' : 'Назначить цвет' }}")
    expect(source).toContain('<RowActionSubmenu v-if="isDm" label="Цвет игрока"')
    expect(source).toContain('<ColorPresetPicker')
    expect(source).toContain('@update:model-value="color => assignColor(color, closeColor)"')
    expect(source).toMatch(/v-if="isDm"[\s\S]*?action="kick"[\s\S]*?>\{\{ kickPending \? 'Исключение…' : 'Выгнать' \}\}<\/RowActionItem>/)
    expect(source).toContain("defineEmits(['view', 'kick', 'color', 'drag-start', 'update:combat-selected', 'update:initiative'])")
  })

  it('uses the whole non-interactive card area as the drag handle', () => {
    expect(source).toContain('@pointerdown="startReorder"')
    expect(source).toContain('@click.capture="suppressReorderClick"')
    expect(source).toContain("const REORDER_IGNORE = 'button, input, textarea, select, a")
    expect(source).toContain("emit('drag-start', event)")
    expect(source).toContain("'p-card--reorderable': reorderEnabled")
    expect(source).not.toContain('p-drag-handle')
    expect(source).not.toContain('GripVertical')
    expect(source).toContain("'p-card-menu--placeholder': reorderPlaceholder")
    expect(source).toContain('.p-card-menu--placeholder :deep(.ram-custom-trigger)')
  })

  it('slides persistent battle controls into the expanded player tile without changing its height', () => {
    expect(source).toContain('<EncounterCombatControls\n            class="p-combat-controls"')
    expect(source).not.toContain('v-if="combatMode"')
    expect(source).toContain(':inert="!combatMode"')
    expect(source).toContain('height: 72px;')
    expect(source).not.toContain('.p-card--combat .p-avatar')
    expect(source).toContain('margin-left: -121px;')
    expect(source).toContain('.p-card--combat .p-combat-controls')
    expect(source).toContain('clip-path: inset(-12px);')
    expect(combatControlsSource).toContain('<EncCheckbox')
    expect(combatControlsSource).toContain('aria-label="Инициатива"')
    expect(source).toContain("const armorClass = computed(() => pvAc(props.participant))")
    expect(source).toContain("'p-card--current': combatMode && combatCurrent")
  })
})
