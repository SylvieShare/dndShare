import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import ChapterGraphTab from './ChapterGraphTab.vue'

const tab = readFileSync(fileURLToPath(new URL('./ChapterGraphTab.vue', import.meta.url)), 'utf8')
const canvas = readFileSync(fileURLToPath(new URL('./ChapterGraphCanvas.vue', import.meta.url)), 'utf8')
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

  it('uses one command bar for session, arc, chapter and combat actions', () => {
    expect(toolbar).toContain('class="chapter-session-title"')
    expect(toolbar).toContain('<SessionStatusMenu')
    expect(toolbar).toContain("$emit('create-chapter')")
    expect(toolbar).toContain("$emit('open-combat')")
  })

  it('supports arcs, node action menus and labelled directed transitions', () => {
    expect(toolbar).toContain("$emit('move-arc', arc.id, -1)")
    expect(toolbar).toContain("$emit('create-arc')")
    expect(tab).toContain('@node-click="openNodeMenu"')
    expect(menus).toContain('Изменить статус')
    expect(menus.match(/<RowActionSubmenu/g)).toHaveLength(2)
    expect(menus).toContain('Создать переход отсюда')
    expect(canvas).toContain('marker-end="url(#chapter-edge-arrow)"')
    expect(canvas).toContain('class="chapter-edge-label"')
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

  it('moves only the presentation of a focused node and locks graph editing', () => {
    expect(tab).toContain(':locked="locked"')
    expect(tab).toContain(':spotlight-chapter-id="spotlightChapterId"')
    expect(tab).toContain('<slot />')
    expect(canvas).toContain("'chapter-canvas--spotlight': spotlightChapterId != null")
    expect(canvas).toContain('scale: 1 / zoom.value')
    expect(canvas).toContain('if (props.locked) return')
    expect(canvas).toContain(':presentation="chapter.id === spotlightChapterId ? spotlightPresentation : null"')
    expect(node).toContain('props.presentation ??')
  })

  it('re-measures the spotlight target after the combat rail changes the safe inset', () => {
    expect(tab).toContain(':spotlight-layout-key="workspaceMode"')
    expect(canvas).toContain('watch(() => [props.spotlightChapterId, props.spotlightLayoutKey], async () => {')
    expect(canvas).toContain('await nextTick()')
    expect(canvas).toContain('viewportRevision.value += 1')
    expect(canvas).toContain("{ flush: 'post' }")
  })

  it('disables transform easing while a node is being dragged', () => {
    expect(canvas).toContain(":dragging=\"gesture?.type === 'node' && gesture.chapter.id === chapter.id\"")
    expect(node).toContain("'chapter-node--dragging': dragging")
    expect(node).toContain('transition-property: opacity, border-color, box-shadow, filter;')
  })
})
