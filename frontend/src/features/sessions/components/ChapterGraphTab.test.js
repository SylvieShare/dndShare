import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import ChapterGraphTab from './ChapterGraphTab.vue'

const tab = readFileSync(fileURLToPath(new URL('./ChapterGraphTab.vue', import.meta.url)), 'utf8')
const canvas = readFileSync(fileURLToPath(new URL('./ChapterGraphCanvas.vue', import.meta.url)), 'utf8')
const toolbar = readFileSync(fileURLToPath(new URL('./ChapterGraphToolbar.vue', import.meta.url)), 'utf8')
const node = readFileSync(fileURLToPath(new URL('./ChapterGraphNode.vue', import.meta.url)), 'utf8')

describe('chapter graph workspace', () => {
  it('compiles the graph tab', () => {
    expect(ChapterGraphTab).toBeTruthy()
  })

  it('keeps the canvas transparent and gives only the toolbar a tile surface', () => {
    expect(toolbar).toContain('<BaseTile class="chapter-toolbar">')
    expect(canvas).not.toContain('<BaseTile')
  })

  it('supports arcs, node action menus and labelled directed transitions', () => {
    expect(toolbar).toContain("$emit('move-arc', arc.id, -1)")
    expect(toolbar).toContain("$emit('create-arc')")
    expect(tab).toContain('@node-click="openNodeMenu"')
    expect(tab).toContain('Изменить статус')
    expect(tab).toContain('Создать переход отсюда')
    expect(canvas).toContain('marker-end="url(#chapter-edge-arrow)"')
    expect(canvas).toContain('class="chapter-edge-label"')
  })

  it('renders the explicit chapter prefix on every graph node', () => {
    expect(node).toContain('Глава {{ chapter.number }}')
  })
})
