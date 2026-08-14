import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import ChapterGraphTab from './ChapterGraphTab.vue'

const tab = readFileSync(fileURLToPath(new URL('./ChapterGraphTab.vue', import.meta.url)), 'utf8')
const canvas = readFileSync(fileURLToPath(new URL('./NestedGraphCanvas.vue', import.meta.url)), 'utf8')
const canvasStyles = readFileSync(fileURLToPath(new URL('./styles/NestedGraphCanvas.css', import.meta.url)), 'utf8')
const sessionCanvas = readFileSync(fileURLToPath(new URL('./SessionGraphCanvas.vue', import.meta.url)), 'utf8')
const actionDock = readFileSync(fileURLToPath(new URL('./CanvasActionDock.vue', import.meta.url)), 'utf8')
const toolbar = readFileSync(fileURLToPath(new URL('./ChapterGraphToolbar.vue', import.meta.url)), 'utf8')
const node = readFileSync(fileURLToPath(new URL('./ChapterGraphNode.vue', import.meta.url)), 'utf8')
const menus = readFileSync(fileURLToPath(new URL('./ChapterGraphMenus.vue', import.meta.url)), 'utf8')

describe('chapter graph workspace', () => {
  it('compiles the graph tab', () => {
    expect(ChapterGraphTab).toBeTruthy()
  })

  it('keeps the canvas transparent and gives only the toolbar a tile surface', () => {
    expect(toolbar).toContain('<BaseTile class="chapter-toolbar">')
    expect(canvas).not.toContain('<BaseTile')
  })

  it('keeps the chapter toolbar square on desktop and mobile', () => {
    expect(toolbar).toContain('.chapter-toolbar {\n  border-radius: 0;')
    expect(toolbar).not.toContain('@media (max-width: 760px) {\n  .chapter-toolbar { border-radius:')
  })

  it('keeps global controls in the command bar and creation on the canvas', () => {
    expect(toolbar).toContain('class="chapter-session-title"')
    expect(toolbar).toContain('<SessionStatusMenu')
    expect(toolbar).not.toContain("$emit('create-chapter')")
    expect(toolbar).toContain("$emit('open-combat')")
    expect(sessionCanvas).toContain("{ id: 'chapter', label: 'Новая глава', icon: 'chapter' }")
    expect(actionDock).toContain('right: calc(var(--chapter-safe-right, 0px) + 16px);')
  })

  it('supports arcs, node action menus and labelled directed transitions', () => {
    expect(toolbar).toContain("$emit('move-arc', arc.id, -1)")
    expect(toolbar).toContain("$emit('create-arc')")
    expect(tab).toContain('@node-click="openNodeMenu"')
    expect(menus).toContain('Изменить статус')
    expect(menus.match(/<RowActionSubmenu/g)).toHaveLength(2)
    expect(menus).toContain('Создать переход отсюда')
    expect(canvas).toContain(':marker-end="`url(#${markerId})`"')
    expect(canvas).toContain('class="nested-graph-edge-label"')
  })

  it('renders the explicit chapter prefix on every graph node', () => {
    expect(node).toContain('Глава {{ chapter.number }}')
  })

  it('uses a full-node image with a blurred text overlay and scene count', () => {
    expect(node).toContain('position: absolute;\n  inset: 0;')
    expect(node).toContain('backdrop-filter: blur(12px)')
    expect(node).toContain('chapter.sceneCount')
    expect(menus).toContain('Сценарии главы')
  })

  it('uses one physical canvas and swaps only its graph payload', () => {
    expect(tab).toContain('<SessionGraphCanvas')
    expect(tab).toContain('<slot />')
    expect(sessionCanvas.match(/<NestedGraphCanvas/g)).toHaveLength(1)
    expect(sessionCanvas).toContain("const displayLevel = ref('chapters')")
    expect(sessionCanvas).toContain("activateLevel('scenes')")
    expect(sessionCanvas).toContain("activateLevel('blocks')")
    expect(canvas).toContain('scale: 1 / zoom.value')
    expect(node).toContain('if (props.embedded) return undefined')
  })

  it('re-measures the safe frame and pins the ancestor chain above the same canvas', () => {
    expect(canvas).toContain("styles.getPropertyValue('--chapter-safe-left')")
    expect(canvas).toContain('viewportRevision.value += 1')
    expect(sessionCanvas).toContain('session-graph-ancestor--chapter')
    expect(sessionCanvas).toContain('session-graph-ancestor--scene')
    expect(sessionCanvas).toContain('@dblclick.stop="returnToChapters"')
    expect(sessionCanvas).toContain('@dblclick.stop="returnToScenes"')
  })

  it('disables transform easing while a node is being dragged', () => {
    expect(canvas).toContain("'nested-graph-node--dragging': gesture?.type === 'node'")
    expect(canvasStyles).toContain('.nested-graph-node--dragging')
  })
})
