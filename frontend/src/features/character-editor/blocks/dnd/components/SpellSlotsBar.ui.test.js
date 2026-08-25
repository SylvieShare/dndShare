import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const barSource = readFileSync(fileURLToPath(new URL('./SpellSlotsBar.vue', import.meta.url)), 'utf8')
const editorSource = readFileSync(fileURLToPath(new URL('../DndSpellbookSettingsModal.vue', import.meta.url)), 'utf8')

describe('spell slots grouped by recovery', () => {
  it('renders both recovery pools inside one slot block', () => {
    expect(barSource).toContain('v-for="pool in activeSlotPools"')
    expect(barSource).toContain("pool.rest === 'short_rest'")
    expect(barSource.match(/title="Ячейки заклинаний"/g)).toHaveLength(1)
    expect(barSource).not.toContain('Ячейки магии договора')
  })

  it('switches the edited pool instead of changing one global recovery flag', () => {
    expect(editorSource).toContain(':model-value="editingRest"')
    expect(editorSource).toContain("$emit('change', editingRest, sl.level, $event)")
    expect(editorSource).not.toContain('set-slots-rest')
  })
})
