import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import SessionGraphCanvas from './SessionGraphCanvas.vue'

const source = readFileSync(fileURLToPath(new URL('./SessionGraphCanvas.vue', import.meta.url)), 'utf8')
const canvasSource = readFileSync(fileURLToPath(new URL('./NestedGraphCanvas.vue', import.meta.url)), 'utf8')
const dockSource = readFileSync(fileURLToPath(new URL('./CanvasActionDock.vue', import.meta.url)), 'utf8')
const blockSource = readFileSync(fileURLToPath(new URL('./SceneBlockNode.vue', import.meta.url)), 'utf8')
const blockMenuSource = readFileSync(fileURLToPath(new URL('./SceneBlockMenus.vue', import.meta.url)), 'utf8')
const sceneSource = readFileSync(fileURLToPath(new URL('./SceneGraphNode.vue', import.meta.url)), 'utf8')
const sceneMenuSource = readFileSync(fileURLToPath(new URL('./SceneGraphMenus.vue', import.meta.url)), 'utf8')
const blockEditorSource = readFileSync(fileURLToPath(new URL('./SceneBlockEditorModal.vue', import.meta.url)), 'utf8')
const combatEditorSource = readFileSync(fileURLToPath(new URL('./SceneCombatCreaturesEditor.vue', import.meta.url)), 'utf8')
const sessionPageSource = readFileSync(fileURLToPath(new URL('../pages/ViewSession.vue', import.meta.url)), 'utf8')
const apiSource = readFileSync(fileURLToPath(new URL('../../../shared/api/scenesApi.js', import.meta.url)), 'utf8')

describe('session graph canvas', () => {
  it('compiles one persistent canvas host', () => {
    expect(SessionGraphCanvas).toBeTruthy()
    expect(source.match(/<NestedGraphCanvas/g)).toHaveLength(1)
    expect(source).toContain(':nodes="activeNodes"')
    expect(source).toContain(':edges="activeEdges"')
  })

  it('drills through scenarios and blocks while keeping ancestors as cards', () => {
    expect(source).toContain("activateLevel('scenes')")
    expect(source).toContain("activateLevel('blocks')")
    expect(source).toContain("transitionSpotlight.value = { level: 'scenes', id: scene.id, offset: 252 }")
    expect(source).toContain('class="session-graph-ancestor session-graph-ancestor--chapter"')
    expect(source).toContain('class="session-graph-ancestor session-graph-ancestor--scene"')
  })

  it('switches graph identity and camera atomically without cross-level node reuse', () => {
    expect(source).toContain("? 0 : 420")
    expect(source).toContain('canvas.value?.prepareView(graphKeyFor(level), initialTopFor(level))')
    expect(source).toContain('transitionSpotlight.value?.level === displayLevel.value')
    expect(source).toContain('requestAnimationFrame(() => {\n    requestAnimationFrame(() =>')
    expect(canvasSource).toContain(':key="`${graphKey}:${node.id}`"')
    expect(canvasSource).toContain('function prepareView(graphKey, initialTop)')
  })

  it('places contextual creation actions at the top-right of the canvas', () => {
    expect(source).toContain('<CanvasActionDock')
    expect(source).toContain("label: 'Новая глава'")
    expect(source).toContain("label: 'Новый сценарий'")
    expect(source).toContain("label: 'Текстовый блок'")
    expect(source).toContain("label: 'Бой'")
    expect(dockSource).toContain('top: 16px;')
    expect(dockSource).not.toContain('translateY(-50%)')
    expect(dockSource).toContain('right: calc(var(--chapter-safe-right, 0px) + 16px);')
  })

  it('recomputes the chapter anchor when the combat player rail widens', () => {
    expect(source).toContain(':layout-key="workspaceMode"')
    expect(canvasSource).toContain('watch(() => props.layoutKey, async () => {')
    expect(canvasSource).toContain("{ flush: 'post' }")
  })

  it('supports server-backed positions and directed links at every level', () => {
    expect(source).toContain("? 'fromChapterId' : displayLevel.value === 'scenes' ? 'fromSceneId' : 'fromItemId'")
    expect(source).toContain('sceneGraph.setLocalPosition')
    expect(source).toContain('blockGraph.setLocalPosition')
    expect(canvasSource).toContain('class="nested-graph-edge-line"')
    expect(canvasSource).toContain('class="nested-graph-link-port"')
    expect(apiSource).toContain('getSceneGraph')
    expect(apiSource).toContain('getSceneBlockGraph')
    expect(apiSource).toContain('createSceneBlockEdge')
  })

  it('derives block presentation from type and opens actions from the whole card', () => {
    expect(blockSource).toContain('sceneBlockColor(block.type)')
    expect(blockSource).not.toContain('RowActionMenu')
    expect(blockSource).not.toContain('Двойной клик')
    expect(source).toContain('blockMenus.value?.openFor(node, anchor)')
    expect(blockMenuSource).toContain('>Копировать</RowActionItem>')
    expect(blockEditorSource).not.toContain('ColorPresetPicker')
  })

  it('opens scenario actions from the whole card without an ellipsis trigger', () => {
    expect(sceneSource).not.toContain('RowActionMenu')
    expect(source).toContain('sceneMenus.value?.openFor(node, anchor)')
    expect(sceneMenuSource).toContain('>Редактировать</RowActionItem>')
    expect(sceneMenuSource).toContain('>Удалить</RowActionItem>')
  })

  it('measures content height and persists width dragged from the right edge', () => {
    expect(source).toContain(':dynamic-node-height="displayLevel === \'blocks\'"')
    expect(source).toContain(':resizable-nodes="displayLevel === \'blocks\'"')
    expect(source).toContain('blockGraph.saveWidth')
    expect(canvasSource).toContain('class="nested-graph-resize-handle"')
    expect(canvasSource).toContain('new ResizeObserver(entries =>')
  })

  it('builds combat blocks from handbook and simplified creatures', () => {
    expect(combatEditorSource).toContain(':item-type-ids="[6]"')
    expect(combatEditorSource).toContain('Создать упрощённо')
    expect(blockMenuSource).toContain('>В бой</RowActionItem>')
    expect(source).toContain("emit('send-block-to-combat', block)")
    expect(sessionPageSource).toContain('itemsApi.byIds(handbookIds)')
    expect(sessionPageSource).toContain('encounter.addNpc(item, count)')
    expect(sessionPageSource).toContain('encounter.addSimpleNpc(creature)')
    expect(sessionPageSource).toContain('await toggleCombatWorkspace()')
  })
})
