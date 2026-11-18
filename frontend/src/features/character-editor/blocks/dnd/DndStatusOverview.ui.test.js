import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { dndStatusSummary } from '../../lib/dndStatusSummary'

const source = readFileSync(fileURLToPath(new URL('./DndStatusOverview.vue', import.meta.url)), 'utf8')
const viewSource = readFileSync(fileURLToPath(new URL('./components/DndStatusOverviewView.vue', import.meta.url)), 'utf8')
const editorSource = readFileSync(fileURLToPath(new URL('./components/CharacterStatusEditor.vue', import.meta.url)), 'utf8')
const schemaFieldSource = readFileSync(fileURLToPath(new URL('../../components/ItemSchemaField.vue', import.meta.url)), 'utf8')

describe('desktop status overview', () => {
  it('renders a frameless summary with one dashed add action', () => {
    expect(source).not.toContain('<BaseTile')
    expect(source).toContain('v-if="summaryItems.length || showAddAction"')
    expect(viewSource).not.toContain('sheet-tile-title')
    expect(viewSource).toContain('class="dsov-add"')
    expect(viewSource).toContain('<span>Состояние</span>')
    expect(viewSource).not.toContain('<Pencil')
    expect(viewSource).toMatch(/\.dsov-add \{[\s\S]*?border: 1px dashed/)
    expect(viewSource).toMatch(/\.dsov \{[\s\S]*?padding: 0 0 15px 15px;/)
    expect(source).toContain("displayMode.value === 'trigger' ? [] : displayItems.value")
    expect(source).toContain("displayMode.value !== 'summary'")
    expect(source).toContain('.dso-root--trigger :deep(.dsov-add) { width: 82px; height: 32px;')
    expect(viewSource.indexOf('class="dsov-add"')).toBeGreaterThan(viewSource.indexOf('class="dsov-row"'))
  })

  it('renders raster or SVG item icons instead of reducing them to color dots', () => {
    expect(viewSource).toContain('<ItemIcon')
    expect(viewSource).toContain('statusIconItem(item, failedIcons.has(item.id))')
    expect(editorSource).toContain('<ItemIcon')
    expect(viewSource).not.toContain('dsov-dot')
  })

  it('keeps 64px icons with the name and thesis to their right', () => {
    expect(viewSource).toMatch(/\.dsov-icon \{[\s\S]*?width: 64px;[\s\S]*?height: 64px;/)
    expect(viewSource).toMatch(/\.dsov-effect \{[\s\S]*?grid-template-columns: 64px minmax\(0, 1fr\);[\s\S]*?border: 0;[\s\S]*?background: transparent;/)
    expect(viewSource).toContain('class="dsov-copy"')
    expect(viewSource).toContain('class="dsov-name"')
    expect(viewSource).toContain('class="dsov-thesis"')
    expect(viewSource).not.toContain('-webkit-line-clamp')
    expect(viewSource).toMatch(/\.dsov-effect \{[\s\S]*?width: 300px;[\s\S]*?gap: 0;[\s\S]*?flex: 0 0 300px;/)
    expect(viewSource).toMatch(/\.dsov-thesis \{[\s\S]*?white-space: pre-line;/)
    expect(schemaFieldSource).toContain("field.type === 'textarea'")
    expect(viewSource).toContain('{{ item.value }}')
    expect(viewSource).toContain('v-if="item.level > 1" class="dsov-level"')
    expect(viewSource).toContain('x{{ item.level }}')
    expect(dndStatusSummary({statuses:[{uid:'effect',params:{level:3},item:{data:{level:1}}}]} )[0].level).toBe(3)
  })

  it('presents exhaustion and inspiration as effects in the same display list', () => {
    const rows=dndStatusSummary({values:{exhaustion:{level:2},inspiration:true}})
    expect(rows.map(row=>row.kind)).toEqual(['exhaustion','inspiration'])
    expect(rows[0].level).toBe(2)
    expect(viewSource).toContain("item.kind === 'exhaustion'")
    expect(viewSource).toContain("item.kind === 'inspiration'")
  })

  it('opens an action menu for view, removal and supported level changes', () => {
    expect(viewSource).toContain('<RowActionMenu')
    expect(viewSource).toContain('Посмотреть')
    expect(viewSource).toContain('Повысить уровень')
    expect(viewSource).toContain('Понизить уровень')
    expect(viewSource).toContain('Убрать')
    expect(source).toContain('<ItemViewModal')
    expect(source).toContain('changeDisplayItemLevel')
  })
})
