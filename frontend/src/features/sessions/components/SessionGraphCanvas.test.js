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
const edgeMenuSource = readFileSync(fileURLToPath(new URL('./NestedEdgeMenus.vue', import.meta.url)), 'utf8')
const blockEditorSource = readFileSync(fileURLToPath(new URL('./SceneBlockEditorModal.vue', import.meta.url)), 'utf8')
const combatEditorSource = readFileSync(fileURLToPath(new URL('./SceneCombatCreaturesEditor.vue', import.meta.url)), 'utf8')
const sessionPageSource = readFileSync(fileURLToPath(new URL('../pages/ViewSession.vue', import.meta.url)), 'utf8')
const edgeEditorSource = readFileSync(fileURLToPath(new URL('../composables/useNestedEdgeEditor.js', import.meta.url)), 'utf8')
const apiSource = readFileSync(fileURLToPath(new URL('../../../shared/api/scenesApi.js', import.meta.url)), 'utf8')
const sessionsApiSource = readFileSync(fileURLToPath(new URL('../../../shared/api/sessionsApi.js', import.meta.url)), 'utf8')
const narrativeCanvasSource = readFileSync(fileURLToPath(new URL('../lib/narrativeCanvas.js', import.meta.url)), 'utf8')
const navigationSource = readFileSync(fileURLToPath(new URL('../composables/useSessionGraphNavigation.js', import.meta.url)), 'utf8')
const stylesSource = readFileSync(fileURLToPath(new URL('./styles/SessionGraphCanvas.css', import.meta.url)), 'utf8')

describe('session graph canvas', () => {
  it('compiles one persistent canvas host', () => {
    expect(SessionGraphCanvas).toBeTruthy()
    expect(source.match(/<NestedGraphCanvas/g)).toHaveLength(1)
    expect(source).toContain(':nodes="activeNodes"')
    expect(source).toContain(':edges="activeEdges"')
  })

  it('drills through scenarios and blocks while keeping ancestors as cards', () => {
    expect(navigationSource).toContain("activateLevel('scenes')")
    expect(navigationSource).toContain("activateLevel('blocks')")
    expect(navigationSource).toContain("transitionSpotlight.value = { level: 'scenes', id: scene.id, offset: 252 }")
    expect(source).toContain('class="session-graph-ancestor session-graph-ancestor--chapter"')
    expect(source).toContain('class="session-graph-ancestor session-graph-ancestor--scene"')
  })

  it('opens chapter actions from the pinned ancestor preview', () => {
    expect(source).toContain('@click.stop="openChapterAncestorMenu"')
    expect(source).toContain('@keydown.enter.stop.prevent="openChapterAncestorMenu"')
    expect(source).toContain("emit('chapter-ancestor-click', activeChapter.value, event.currentTarget)")
    expect(source).toContain("'chapter-ancestor-click', 'scene-count'")
  })

  it('switches graph identity and camera atomically without cross-level node reuse', () => {
    expect(navigationSource).toContain("? 0 : 420")
    expect(navigationSource).toContain("canvas.value?.prepareView(graphKeyFor(level), level === 'chapters' ? 80 : 210)")
    expect(source).toContain('transitionSpotlight.value?.level === displayLevel.value')
    expect(navigationSource).toContain('requestAnimationFrame(() => {\n      requestAnimationFrame(() =>')
    expect(canvasSource).toContain(':key="`${graphKey}:${node.id}`"')
    expect(canvasSource).toContain('function prepareView(graphKey, initialTop)')
  })

  it('places contextual creation actions at the top-right of the canvas', () => {
    expect(source).toContain('<CanvasActionDock')
    expect(narrativeCanvasSource).toContain("label: 'Новая глава'")
    expect(narrativeCanvasSource).toContain("label: 'Новый сценарий'")
    expect(narrativeCanvasSource).toContain("{ id: 'text', label: 'Описание', icon: 'text' }")
    expect(narrativeCanvasSource).toContain("label: 'Бой'")
    expect(dockSource).toContain('top: 16px;')
    expect(dockSource).not.toContain('translateY(-50%)')
    expect(dockSource).toContain('right: calc(var(--chapter-safe-right, 0px) + 16px);')
  })

  it('recomputes the chapter anchor when the combat player rail widens', () => {
    expect(source).toContain(':layout-key="workspaceLayoutMode"')
    expect(sessionPageSource).toContain(':workspace-mode="workspaceMode"')
    expect(sessionPageSource).toContain(':workspace-layout-mode="workspaceMotionMode"')
    expect(canvasSource).toContain('watch(() => props.layoutKey, async () => {')
    expect(canvasSource).toContain("{ flush: 'post' }")
  })

  it('keeps the selected chapter and scenario mounted across combat mode', () => {
    expect(navigationSource).toContain("const preservedNestedContext = previousMode === 'combat'")
    expect(navigationSource).toContain("if (previousMode !== 'scenes') displayLevel.value = 'chapters'")
    expect(navigationSource).not.toContain("if (mode === 'combat') {\n      rememberedChapterId = props.workspaceChapterId\n      displayLevel.value = 'chapters'")
    expect(source).toContain("'session-graph-canvas__nested--combat-hidden': workspaceMode === 'combat' && displayLevel !== 'chapters'")
    expect(stylesSource).toMatch(/\.session-graph-canvas__nested--combat-hidden\s*\{[^}]*opacity:\s*0;[^}]*pointer-events:\s*none;/s)
    expect(stylesSource).toContain('transition: left 0.42s cubic-bezier(0.22, 1, 0.36, 1);')
  })

  it('supports server-backed positions and directed links at every level', () => {
    expect(source).toContain("? 'fromChapterId' : displayLevel.value === 'scenes' ? 'fromSceneId' : 'fromItemId'")
    expect(source).toContain('sceneGraph.setLocalPositions')
    expect(source).toContain('blockGraph.setLocalPositions')
    expect(canvasSource).toContain('class="nested-graph-edge-line"')
    expect(canvasSource).toContain('class="nested-graph-link-port"')
    expect(apiSource).toContain('getSceneGraph')
    expect(apiSource).toContain('getSceneBlockGraph')
    expect(apiSource).toContain('createSceneBlockEdge')
  })

  it('persists and deletes selected nodes atomically at every graph level', () => {
    expect(source).toContain('@preview-positions="previewPositions"')
    expect(source).toContain('@save-positions="savePositions"')
    expect(source).toContain('@delete-selection="requestSelectionDelete"')
    expect(source).toContain("emit('delete-nodes', ids)")
    expect(source).toContain('sceneGraph.deleteScenes(value.ids)')
    expect(source).toContain('blockGraph.deleteItems(value.ids)')
    expect(sessionsApiSource).toContain('/graph-nodes/positions')
    expect(sessionsApiSource).toContain('/graph-nodes/delete')
  })

  it('offers canonical bulk statuses for chapter and scenario nodes', () => {
    expect(source).toContain("displayLevel === 'scenes' ? SCENE_STATUSES : []")
    expect(source).toContain("emit('change-nodes-status', status, ids)")
    expect(source).toContain('sceneGraph.updateSceneStatuses(ids, status)')
    expect(sessionsApiSource).toContain('/graph-nodes/status')
  })

  it('creates scenario and block transitions directly while keeping label editing available', () => {
    expect(source).toContain('<ChapterEdgeModal')
    expect(source).toContain('await createNestedEdge(displayLevel.value, from, node)')
    expect(edgeEditorSource).toContain('await graph.createEdge(from.id, to.id, null)')
    expect(edgeEditorSource).toContain('await graph.updateEdge(edge.id, label)')
    expect(edgeEditorSource).not.toContain('pendingEdge')
    expect(edgeMenuSource).toContain('>Изменить подпись</RowActionItem>')
    expect(edgeMenuSource).toContain('>Удалить переход</RowActionItem>')
    expect(apiSource).toContain('updateSceneEdge')
    expect(apiSource).toContain('updateSceneBlockEdge')
  })

  it('derives block presentation from type and opens actions from the whole card', () => {
    expect(blockSource).toContain('sceneBlockColor(block.type)')
    expect(blockSource).toContain('background: var(--surface);')
    expect(blockSource).not.toContain('background: var(--surface-raised);')
    expect(blockSource).not.toContain('RowActionMenu')
    expect(blockSource).not.toContain('Двойной клик')
    expect(source).toContain('blockMenus.value?.openFor(node, anchor)')
    expect(blockMenuSource).toContain('>Копировать</RowActionItem>')
    expect(blockEditorSource).toContain('<ColorPresetPicker')
    expect(blockEditorSource).toContain('setDialogueColor(row, color)')
    expect(blockEditorSource).toContain('<SceneRewardItemsEditor v-model="draft.items"')
    expect(blockSource).not.toContain('scene-block-node-strip')
    expect(blockSource).toContain('scene-block-node-dialogue')
    expect(blockSource).toContain('scene-block-node-dialogue-line')
    expect(blockSource).toContain('text-align: right;')
    expect(blockSource).not.toContain('background: color-mix(in srgb, var(--dialogue-color) 9%')
    expect(blockSource).toContain('var(--block-color) 52%')
    expect(blockSource).toContain('scene-block-node-heading')
    expect(blockSource).toContain('font-size: 18px;')
    expect(blockEditorSource).toContain('placeholder="Участник"')
    expect(blockEditorSource).toContain(':list="dialogueKeysListId"')
    expect(narrativeCanvasSource).toContain("{ id: 'list', label: 'Диалог', icon: 'dialogue' }")
    expect(narrativeCanvasSource).toContain("{ id: 'reward', label: 'Награда', icon: 'reward' }")
    expect(dockSource).toContain("action.icon === 'dialogue'")
    expect(dockSource).toContain("action.icon === 'reward'")
    expect(blockSource).toContain(':item="itemById(creature.itemId)"')
    expect(blockSource).toContain("block.type === 'reward'")
  })

  it('opens scenario actions from the whole card without an ellipsis trigger', () => {
    expect(sceneSource).not.toContain('RowActionMenu')
    expect(source).toContain('sceneMenus.value?.openFor(node, anchor)')
    expect(sceneMenuSource).toContain('>Редактировать</RowActionItem>')
    expect(sceneMenuSource).toContain('>Открыть элементы</RowActionItem>')
    expect(sceneMenuSource).toContain('Изменить статус')
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
    expect(source).toContain("emit('send-block-to-combat', {")
    expect(source).toContain('chapter: activeChapter.value')
    expect(source).toContain('scene: combatSceneContext()')
    expect(sessionPageSource).toContain('itemsApi.byIds(handbookIds)')
    expect(sessionPageSource).toContain('encounter.addNpc(item, count)')
    expect(sessionPageSource).toContain('encounter.addSimpleNpc(creature)')
    expect(sessionPageSource).toContain('await toggleCombatWorkspace({ chapter, scene, level })')
  })
})
