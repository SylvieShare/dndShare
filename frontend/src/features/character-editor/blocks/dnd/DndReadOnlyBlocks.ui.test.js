import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

function source(path) {
  return readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
}

describe('read-only character sheet blocks', () => {
  it('keeps stat rolls available but does not open characteristic editors', () => {
    const stat = source('./DndCharStat10.vue')
    expect(stat).toContain(':show-edit="canEdit"')
    expect(stat).toContain('const canEdit = computed(() => !!charCtx.ownerMode)')
    expect(stat).toContain('if (!canEdit.value) return')
    expect(stat).toContain('@roll-stat=')
  })

  it('guards HP, exhaustion and utility editors with owner mode', () => {
    const hp = source('./DndHp.vue')
    const exhaustion = source('./DndExhaustion.vue')
    const utility = source('./components/StatTile.vue')
    expect(hp).toContain('if (!canEdit.value) return')
    expect(hp).toContain('if (canEdit.value) openMorph()')
    expect(exhaustion).toContain('if (canEdit.value) openMorph()')
    expect(exhaustion).toContain(':editable="canEdit"')
    expect(utility).toContain('if (canEdit.value) openMorph()')
    expect(utility).toContain('if (props.rollable || canEdit.value)')
  })
})
