import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./DndStatusOverview.vue', import.meta.url)), 'utf8')
const viewSource = readFileSync(fileURLToPath(new URL('./components/DndStatusOverviewView.vue', import.meta.url)), 'utf8')
const editorSource = readFileSync(fileURLToPath(new URL('./components/CharacterStatusEditor.vue', import.meta.url)), 'utf8')

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
    expect(viewSource.indexOf('class="dsov-add"')).toBeGreaterThan(viewSource.indexOf('class="dsov-row"'))
  })

  it('renders raster or SVG item icons instead of reducing them to color dots', () => {
    expect(viewSource).toContain('<ItemIcon')
    expect(viewSource).toContain('item.item.iconImageUrl || item.item.svg')
    expect(editorSource).toContain('<ItemIcon')
    expect(viewSource).not.toContain('dsov-dot')
  })

  it('keeps 64px icons with the name and thesis to their right', () => {
    expect(viewSource).toMatch(/\.dsov-icon \{[\s\S]*?width: 64px;[\s\S]*?height: 64px;/)
    expect(viewSource).toMatch(/\.dsov-effect \{[\s\S]*?grid-template-columns: 64px minmax\(0, 1fr\);[\s\S]*?border: 0;[\s\S]*?background: none;/)
    expect(viewSource).toContain('class="dsov-copy"')
    expect(viewSource).toContain('class="dsov-name"')
    expect(viewSource).toContain('class="dsov-thesis"')
    expect(viewSource).not.toContain('-webkit-line-clamp')
    expect(viewSource).toContain('{{ item.value }}')
    expect(viewSource).toContain('Уровень {{ item.level }}')
    expect(source).toContain('status.params?.level ?? status.item?.data?.level')
  })

  it('presents exhaustion and inspiration as effects in the same display list', () => {
    expect(source).toContain("kind: 'exhaustion'")
    expect(source).toContain("kind: 'inspiration'")
    expect(source).toContain('level: exhaustionLevel.value')
    expect(source).toContain("itemByCode?.('exhaustion')")
    expect(source).toContain("itemByCode?.('inspiration')")
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
