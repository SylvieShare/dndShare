import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./DndItems.vue', import.meta.url)), 'utf8')

describe('inventory item actions', () => {
  it('uses one row menu for spending, replenishing and editing', () => {
    expect(source).toContain('<RowActionMenu')
    expect(source).toContain('>Потратить</RowActionItem>')
    expect(source).toContain('>Добавить</RowActionItem>')
    expect(source).toContain('>Изменить</RowActionItem>')
    expect(source).not.toContain('FormNumberInput')
  })

  it('publishes semantic inventory events', () => {
    expect(source).toContain("type: 'item_spent'")
    expect(source).toContain("type: 'item_added'")
  })

  it('includes linked handbook subsections and moves their entries to specialized blocks', () => {
    expect(source).toContain('itemTypesStore.relatedTypeIds(rootTypeId.value)')
    expect(source).toContain('specialized_destinations')
    expect(source).toContain('moveToSpecialized')
    expect(source).toContain('ownedEntryToWeapons')
    expect(source).toContain('charCtx.updateValues({ items: taken.inventory, [targetId]: target })')
  })

  it('uses the same 52px icon component as weapon rows', () => {
    expect(source).toContain(':image-url="entry.display.iconImageUrl"')
    expect(source).toContain(':type-image-url="entry.display.typeImageUrl"')
  })
})
