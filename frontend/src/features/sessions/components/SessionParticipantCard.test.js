import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import SessionParticipantCard from './SessionParticipantCard.vue'

const source = readFileSync(fileURLToPath(new URL('./SessionParticipantCard.vue', import.meta.url)), 'utf8')

describe('SessionParticipantCard actions', () => {
  it('compiles the participant component', () => {
    expect(SessionParticipantCard).toBeTruthy()
  })

  it('opens a shared row action menu from the participant BaseTile', () => {
    expect(source).toContain('<RowActionMenu>')
    expect(source).toContain('<template #trigger>')
    expect(source).toContain('<BaseTile class="p-card" interactive>')
  })

  it('makes the action trigger and participant tile span the whole rail', () => {
    expect(source).toContain('.p-card-menu {\n  width: 100%;\n}')
    expect(source).toContain('.p-card-menu :deep(.ram-custom-trigger) {\n  display: flex;\n  width: 100%;\n}')
    expect(source).toContain('.p-card {\n  width: 100%;\n  box-sizing: border-box;')
  })

  it('offers view to everyone and kick only to the DM', () => {
    expect(source).toContain('>Просмотреть</button>')
    expect(source).toMatch(/v-if="isDm"[\s\S]*?>\{\{ kickPending \? 'Исключение…' : 'Выгнать' \}\}<\/button>/)
    expect(source).toContain("defineEmits(['view', 'kick'])")
  })
})
