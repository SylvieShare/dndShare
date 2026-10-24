import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
const source = readFileSync(new URL('./SessionParticipantCard.vue', import.meta.url), 'utf8')
it('delegates layout to the common tile while preserving player actions and permissions', () => {
  expect(source).toContain('<SessionCreatureTile')
  expect(source).toContain(':controls-visible="combatMode"')
  expect(source).toContain(':has-statuses="hasStatuses"')
  expect(source).toContain(':compact="compact"')
  expect(source).toContain('<RowActionMenu>')
  expect(source).toContain('isDm || participant.canOpenSheet')
  expect(source).toContain('<RowActionSubmenu v-if="isDm" label="Цвет игрока"')
  expect(source).toContain('action="kick"')
  expect(source).toContain('При смерти')
  expect(source).toContain('aria-label="Воскресить игрока"')
  expect(source).toContain('@pointerdown="startReorder"')
  expect(source).toContain('@click.capture="suppressReorderClick"')
})
