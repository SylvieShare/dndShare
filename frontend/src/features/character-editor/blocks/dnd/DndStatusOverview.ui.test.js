import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./DndStatusOverview.vue', import.meta.url)), 'utf8')
const viewSource = readFileSync(fileURLToPath(new URL('./components/DndStatusOverviewView.vue', import.meta.url)), 'utf8')
const editorSource = readFileSync(fileURLToPath(new URL('./components/CharacterStatusEditor.vue', import.meta.url)), 'utf8')
const inspirationSource = readFileSync(fileURLToPath(new URL('./components/DndInspirationEditor.vue', import.meta.url)), 'utf8')

describe('desktop status overview', () => {
  it('uses a frameless summary with one explicit edit action', () => {
    expect(source).not.toContain('<BaseTile')
    expect(viewSource).not.toContain('sheet-tile-title')
    expect(viewSource).not.toContain('Добавить эффект')
    expect(viewSource).not.toContain('Добавить вдохновение')
    expect(viewSource).toContain('Редактировать состояние')
    expect(viewSource).toContain('<Pencil')
    expect(viewSource).toContain("$emit('edit', 'states')")
    expect(source).toContain("displayMode.value === 'trigger' ? [] : displayItems.value")
    expect(source).toContain("displayMode.value !== 'summary'")
  })

  it('renders raster or SVG item icons instead of reducing them to color dots', () => {
    expect(viewSource).toContain('<ItemIcon')
    expect(viewSource).toContain('item.item.iconImageUrl || item.item.svg')
    expect(editorSource).toContain('<ItemIcon')
    expect(viewSource).not.toContain('dsov-dot')
  })

  it('puts the effect name and optional level in a rounded block directly below its frameless 64px icon', () => {
    expect(viewSource).toMatch(/\.dsov-icon \{[\s\S]*?width: 64px;[\s\S]*?height: 64px;/)
    expect(viewSource).toMatch(/\.dsov-effect \{[\s\S]*?border: 0;[\s\S]*?background: none;/)
    expect(viewSource).toContain('class="dsov-caption"')
    expect(viewSource).toMatch(/\.dsov-caption \{[\s\S]*?border-radius: 7px;/)
    expect(viewSource).not.toContain('backdrop-filter')
    expect(viewSource).toContain('Уровень {{ item.level }}')
    expect(source).toContain('Number(status.item?.data?.level)')
  })

  it('presents exhaustion and inspiration as effects in the same display list', () => {
    expect(source).toContain("kind: 'exhaustion'")
    expect(source).toContain("kind: 'inspiration'")
    expect(source).toContain('level: exhaustionLevel.value')
    expect(viewSource).toContain("item.kind === 'exhaustion'")
    expect(viewSource).toContain("item.kind === 'inspiration'")
  })

  it('keeps one editor with controls for effects, exhaustion and inspiration', () => {
    expect(source).toContain('role="tablist"')
    expect(source).toContain("v-if=\"editorKind === 'states'\"")
    expect(source).toContain("v-else-if=\"editorKind === 'exhaustion'\"")
    expect(source).toContain('<DndInspirationEditor')
    expect(inspirationSource).toContain(':aria-pressed="active"')
    expect(inspirationSource).toContain("$emit('change', !active)")
  })
})
