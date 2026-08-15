import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import ChapterGraphTab from './ChapterGraphTab.vue'

const tab = readFileSync(fileURLToPath(new URL('./ChapterGraphTab.vue', import.meta.url)), 'utf8')
const canvas = readFileSync(fileURLToPath(new URL('./NestedGraphCanvas.vue', import.meta.url)), 'utf8')
const canvasStyles = readFileSync(fileURLToPath(new URL('./styles/NestedGraphCanvas.css', import.meta.url)), 'utf8')
const sessionCanvas = readFileSync(fileURLToPath(new URL('./SessionGraphCanvas.vue', import.meta.url)), 'utf8')
const selectionBar = readFileSync(fileURLToPath(new URL('./GraphSelectionBar.vue', import.meta.url)), 'utf8')
const actionDock = readFileSync(fileURLToPath(new URL('./CanvasActionDock.vue', import.meta.url)), 'utf8')
const narrativeCanvas = readFileSync(fileURLToPath(new URL('../lib/narrativeCanvas.js', import.meta.url)), 'utf8')
const toolbar = readFileSync(fileURLToPath(new URL('./ChapterGraphToolbar.vue', import.meta.url)), 'utf8')
const node = readFileSync(fileURLToPath(new URL('./ChapterGraphNode.vue', import.meta.url)), 'utf8')
const hotkeyHints = readFileSync(fileURLToPath(new URL('./CanvasHotkeyHints.vue', import.meta.url)), 'utf8')
const hotkeys = readFileSync(fileURLToPath(new URL('../composables/useGraphHotkeys.js', import.meta.url)), 'utf8')

describe('chapter graph workspace', () => {
  it('compiles the graph tab', () => {
    expect(ChapterGraphTab).toBeTruthy()
  })

  it('keeps the canvas transparent and gives its semantic header a plain divided surface', () => {
    expect(toolbar).toContain('<header class="chapter-toolbar">')
    expect(toolbar).not.toContain('<BaseTile')
    expect(toolbar).toContain('border-bottom: 1px solid var(--border);')
    expect(toolbar).toContain('background: var(--bg);')
    expect(canvas).not.toContain('<BaseTile')
  })

  it('keeps dice, music and session log toggles in the header', () => {
    expect(toolbar).toContain('aria-label="Кубики"')
    expect(toolbar).toContain('aria-label="Музыка"')
    expect(toolbar).toContain('aria-label="Лог сессии"')
    expect(toolbar).toContain("$emit('toggle-dice')")
    expect(toolbar).toContain("$emit('toggle-music')")
    expect(toolbar).toContain("$emit('toggle-events')")
  })

  it('keeps global controls in the command bar and creation on the canvas', () => {
    expect(toolbar).toContain('class="chapter-session-title"')
    expect(toolbar).toContain('<SessionStatusMenu')
    expect(toolbar).not.toContain("$emit('create-chapter')")
    expect(toolbar).toContain("$emit('open-combat')")
    expect(toolbar).toContain('aria-label="Бой"')
    expect(toolbar).toContain('<Swords :size="19" />')
    expect(toolbar).not.toContain('Текущая глава')
    expect(toolbar).not.toContain('chapter-zoom')
    expect(toolbar).not.toContain("'focus-current'")
    expect(toolbar).not.toContain("'zoom'")
    expect(narrativeCanvas).toContain("{ id: 'chapter', label: 'Новая глава', icon: 'chapter' }")
    expect(actionDock).toContain('right: calc(var(--chapter-safe-right, 0px) + 16px);')
  })

  it('supports arcs, node action menus and labelled directed transitions', () => {
    expect(toolbar).toContain("$emit('move-arc', arc.id, -1)")
    expect(toolbar).toContain("$emit('create-arc')")
    expect(tab).toContain('@node-click="openNodeMenu"')
    expect(tab).not.toContain('<ChapterGraphMenus')
    expect(tab).toContain('Изменить статус')
    expect(tab).toContain(':style="{ color: status.color }"')
    expect(tab.match(/<RowActionSubmenu/g)).toHaveLength(2)
    expect(tab).toContain('Создать переход отсюда')
    expect(tab).toContain('<RowActionItem action="delete" tone="danger"')
    expect(canvas).toContain(':marker-end="`url(#${markerId})`"')
    expect(canvas).toContain('class="nested-graph-edge-label"')
  })

  it('renders the explicit chapter prefix on every graph node', () => {
    expect(node).toContain('Глава {{ chapter.number }}')
    expect(node).toContain('>Сейчас здесь</span>')
    expect(tab).toContain('Отметить «Сейчас здесь»')
  })

  it('uses a full-node image with a blurred text overlay and scene count', () => {
    expect(node).toContain('position: absolute;\n  inset: 0;')
    expect(node).toContain('backdrop-filter: blur(12px)')
    expect(node).toContain('chapter.sceneCount')
    expect(tab).toContain('Сценарии главы')
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
    expect(canvas).toContain('bounds: contentBounds.value')
    expect(canvas).toContain('pan.value = constrainPan({')
    expect(sessionCanvas).toContain('session-graph-ancestor--chapter')
    expect(sessionCanvas).toContain('session-graph-ancestor--scene')
    expect(sessionCanvas).toContain('@dblclick.stop="returnToChapters"')
    expect(sessionCanvas).toContain('@dblclick.stop="returnToScenes"')
    expect(sessionCanvas).toContain('@click.stop="openChapterAncestorMenu"')
    expect(sessionCanvas).toContain("emit('chapter-ancestor-click', activeChapter.value, event.currentTarget)")
    expect(tab).toContain('@chapter-ancestor-click="openChapterAncestorMenu"')
    expect(tab).toContain('Вернуться к главам')
  })

  it('disables transform easing while a node is being dragged', () => {
    expect(canvas).toContain("'nested-graph-node--dragging': isDraggedNode(node)")
    expect(canvasStyles).toContain('.nested-graph-node--dragging')
  })

  it('supports modifier selection, group dragging and a safe-frame bulk action bar', () => {
    expect(canvas).toContain('event.ctrlKey || event.metaKey')
    expect(canvas).toContain('beginFrameSelection(event, null')
    expect(canvas).toContain('class="nested-graph-selection-frame"')
    expect(canvas).toContain("'nested-graph-node--selected': isSelected(node)")
    expect(canvas).toContain("emit('preview-positions', translateGraphPositions")
    expect(canvas).toContain('<GraphSelectionBar')
    expect(selectionBar).toContain('class="graph-selection-bar"')
    expect(selectionBar).toContain('Выбрано: {{ count }}')
    expect(selectionBar).toContain('Статус')
    expect(selectionBar).toContain(':style="{ color: status.color }"')
    expect(canvas).toContain("$emit('delete-selection', selectedNodes.map(node => node.id))")
    expect(canvasStyles).toContain('.nested-graph-node--selected::after')
    expect(selectionBar).toContain('.graph-selection-bar')
    expect(tab).toContain('@delete-nodes="confirmChaptersDelete"')
    expect(tab).toContain('graph.deleteChapters(state.ids)')
    expect(tab).toContain('graph.updateChapterStatuses(ids, status)')
  })

  it('shows and implements a frameless desktop hotkey legend below the player rail', () => {
    expect(sessionCanvas).toContain('<CanvasHotkeyHints')
    expect(hotkeyHints).toContain('bottom: 14px;')
    expect(hotkeyHints).toContain('left: 14px;')
    expect(hotkeyHints).toContain('{{ modifier }} + клик')
    expect(hotkeyHints).toContain('{{ modifier }} + A')
    expect(hotkeyHints).toContain('<kbd>+ / −</kbd>')
    expect(hotkeyHints).toContain('(pointer: coarse)')
    expect(hotkeys).toContain("event.code === 'KeyA'")
    expect(hotkeys).toContain("deleteSelection(selectedNodes.value.map(node => node.id))")
    expect(hotkeys).toContain('zoomBy(1.15)')
  })
})
