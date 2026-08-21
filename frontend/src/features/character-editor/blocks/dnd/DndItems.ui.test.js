import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./DndItems.vue', import.meta.url)), 'utf8')
const iconSource = readFileSync(fileURLToPath(new URL('../../components/InventoryItemIcon.vue', import.meta.url)), 'utf8')
const blocks = JSON.parse(readFileSync(fileURLToPath(new URL('../../settings/dnd/blocks.json', import.meta.url)), 'utf8'))

describe('inventory item actions', () => {
  it('uses quantity actions and only edits simplified custom items', () => {
    expect(source).toContain('<RowActionMenu')
    expect(source).not.toContain('>Потратить</RowActionItem>')
    expect(source).toContain('>Добавить +1</RowActionItem>')
    expect(source).toContain('>Удалить одну</RowActionItem>')
    expect(source).toContain('v-if="canManage && entry.count > 1"')
    expect(source).toContain('v-if="canManage && entry.item_id == null"')
    expect(source).toContain('>Изменить</RowActionItem>')
    expect(source).not.toContain('FormNumberInput')
  })

  it('publishes semantic inventory additions without treating removal as spending', () => {
    expect(source).not.toContain("type: 'item_spent'")
    expect(source).toContain("type: 'item_added'")
  })

  it('includes linked handbook subsections and moves only weapon and potion entries to specialized blocks', () => {
    expect(source).toContain('itemTypesStore.relatedTypeIds(rootTypeId.value)')
    expect(source).toContain('specialized_destinations')
    expect(source).toContain('moveToSpecialized')
    expect(source).toContain('ownedEntryToWeapons')
    expect(source).toContain('charCtx.updateValues({ items: taken.inventory, [targetId]: target })')
    expect(blocks.items.content.specialized_destinations.map((destination) => destination.value_id)).toEqual(['weapon', 'potions'])
    expect(blocks.tools).toBeUndefined()
  })

  it('shows tools as inventory items without mutating character proficiencies', () => {
    expect(source).toContain("'di-row-tool': isToolEntry(entry)")
    expect(source).toContain('{{ toolCategoryLabel(entry) }}')
    expect(source).toContain('entryHasProficiency(entry)')
    expect(source).toContain('class="di-item-proficient">Владение</span>')
    expect(source).not.toContain('isToolProficient')
    expect(source).not.toContain('toggleToolProficiency')
    expect(source).not.toContain('charCtx.updateValues({ proficiencies })')
    expect(blocks.items.content.tool_proficiency_bucket).toBeUndefined()
  })

  it('uses 64px handbook icons for inventory rows', () => {
    expect(source).toContain(':image-url="entry.display.iconImageUrl"')
    expect(source).toContain(':type-image-url="entry.display.typeImageUrl"')
    expect(iconSource).toContain('width: 64px')
    expect(iconSource).toContain('height: 64px')
    expect(iconSource).toContain('flex: 0 0 64px')
  })
})
