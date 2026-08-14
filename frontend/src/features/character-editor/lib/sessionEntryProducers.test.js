import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

function source(path) {
  return readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
}

describe('character entry event producers', () => {
  it.each([
    ['предметы', '../blocks/dnd/DndItems.vue', "kind: 'item'"],
    ['зелья', '../blocks/dnd/DndPotions.vue', "kind: 'potion'"],
    ['заклинания', '../blocks/dnd/DndSpells.vue', "kind: 'spell'"],
    ['оружие', '../blocks/dnd/DndWeapons.vue', "category: 'weapon'"],
    ['черты и способности', '../blocks/dnd/DndAbilities.vue', "? 'feature' : 'ability'"],
    ['повышение уровня', '../blocks/dnd/DndLvl.vue', 'for (const addition of additions)'],
  ])('logs additions from %s', (_label, path, marker) => {
    const component = source(path)
    expect(component).toContain('logSessionEntryAdded')
    expect(component).toContain(marker)
  })
})
