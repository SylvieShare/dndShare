import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import SessionLocationsWorkspace from './SessionLocationsWorkspace.vue'
import SessionNpcsWorkspace from './SessionNpcsWorkspace.vue'
import SessionWorldLayer from './SessionWorldLayer.vue'
import SessionQuestsWorkspace from './SessionQuestsWorkspace.vue'

const read = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
const toolbar = read('./ChapterGraphToolbar.vue')
const graphTab = read('./ChapterGraphTab.vue')
const layer = read('./SessionWorldLayer.vue')
const workspaceStyles = read('./styles/SessionWorldWorkspace.css')
const locations = read('./SessionLocationsWorkspace.vue')
const treeRow = read('./LocationTreeRow.vue')
const locationEditor = read('./LocationEditorModal.vue')
const npcs = read('./SessionNpcsWorkspace.vue')
const npcEditor = read('./NpcEditorModal.vue')
const relationPicker = read('./WorldRelationPickerModal.vue')
const universalEditor = read('./UniversalRelationEditor.vue')
const universalList = read('./UniversalRelationList.vue')
const universalPicker = read('./UniversalRelationPickerModal.vue')
const quests = read('./SessionQuestsWorkspace.vue')
const questEditor = read('./QuestEditorModal.vue')
const materials = read('./SessionMaterialsWorkspace.vue')
const music = read('./SessionMusicWorkspace.vue')
const entityDetail = read('./SessionEntityDetail.vue')
const scenarioUsages = read('./ScenarioUsageList.vue')
const imagePicker = read('./SessionImagePicker.vue')
const primaryView = read('../composables/useSessionPrimaryView.js')
const worldState = read('../composables/useSessionWorld.js')
const api = read('../../../shared/api/sessionsApi.js')
const sessionView = read('../pages/ViewSession.vue')
const sessionWorkspace = read('../composables/useSessionWorkspace.js')

describe('session world workspaces', () => {
  it('compiles all central world modes', () => {
    expect(SessionWorldLayer).toBeTruthy()
    expect(SessionLocationsWorkspace).toBeTruthy()
    expect(SessionNpcsWorkspace).toBeTruthy()
	expect(SessionQuestsWorkspace).toBeTruthy()
  })

  it('switches the central workspace from the semantic session header', () => {
    expect(toolbar).toContain('aria-label="Раздел сессии"')
    expect(toolbar).toContain("{ key: 'story', label: 'Сюжет'")
    expect(toolbar).toContain("{ key: 'locations', label: 'Локации'")
    expect(toolbar).toContain("{ key: 'npcs', label: 'NPC'")
    expect(toolbar).toContain("{ key: 'quests', label: 'Задания'")
    expect(toolbar).toContain("{ key: 'music', label: 'Музыка'")
    expect(graphTab).toContain('v-show="primaryView === \'story\'"')
    expect(graphTab).toContain('<slot v-if="primaryView !== \'story\'" name="primary-workspace" />')
    expect(sessionView).toContain('<SessionCenterWorkspace')
    expect(sessionView).toContain('v-show="primaryView === \'story\'"')
    expect(sessionView).toContain("'campaign-workspace--combat': primaryView === 'story' && workspaceMotionMode === 'combat'")
    expect(sessionView).toContain("visibleWorkspaceMotionMode = computed(() => primaryView.value === 'story' ? workspaceMotionMode.value : null)")
    expect(layer).toContain("activeView === 'locations'")
    expect(layer).toContain("activeView === 'npcs'")
    expect(layer).toContain("activeView === 'quests'")
    expect(sessionView).toContain('<SessionMusicWorkspace v-if="primaryView === \'music\'"')
    expect(toolbar.indexOf("{ key: 'quests', label: 'Задания'")).toBeLessThan(toolbar.indexOf("{ key: 'materials', label: 'Материалы'"))
  })

  it('renders music as a central workspace instead of a fullscreen library modal', () => {
    expect(music).toContain('class="session-music-workspace"')
    expect(music).not.toContain('<AppModal fullscreen')
    expect(sessionView).not.toContain('MusicLibraryModal')
    expect(sessionView).not.toContain('musicLibraryOpen')
    expect(primaryView).toContain("'music'")
  })

  it('uses one detail header and edit action for all session catalogues', () => {
    for (const workspace of [locations, npcs, quests, materials]) {
      expect(workspace).toContain('<SessionEntityDetail')
    }
    expect(entityDetail).toContain('session-entity-detail-head')
    expect(entityDetail).toContain('<Pencil :size="15" />Редактировать')
    expect(materials).toContain('<div class="session-world-section-title"><span>Просмотр</span></div>')
  })

  it('navigates every visible catalogue with vertical arrows', () => {
    for (const workspace of [locations, npcs, quests, materials]) {
      expect(workspace).toContain('defineExpose({ moveSelection })')
      expect(workspace).toContain('session-world-list-navigation-hint')
      expect(workspace).toContain('scrollSessionListItemIntoView')
    }
    expect(layer).toContain('moveSelection: direction => activeWorkspace.value?.moveSelection(direction)')
    expect(sessionView).toContain('previousListItem: () => worldLayer.value?.moveSelection(-1)')
    expect(sessionView).toContain('nextListItem: () => worldLayer.value?.moveSelection(1)')
    expect(locations).toContain('visibleLocations')
    expect(treeRow).toContain(':data-session-list-id="node.id"')
  })

  it('keeps the shared canvas dot field behind location, NPC and loading states', () => {
    expect(workspaceStyles).toContain('background-image: var(--app-canvas-pattern);')
    expect(workspaceStyles).toContain('background-size: var(--app-canvas-dot-size) var(--app-canvas-dot-size);')
    expect(layer).toContain('background-image: var(--app-canvas-pattern);')
    expect(layer).toContain('background-size: var(--app-canvas-dot-size) var(--app-canvas-dot-size);')
  })

  it('persists the primary mode and exposes deep-linked selections', () => {
    expect(primaryView).toContain('dnd-share:session-primary-view:v1:')
    expect(primaryView).toContain('route.query.location')
    expect(primaryView).toContain('route.query.npc')
	expect(primaryView).toContain('route.query.quest')
	expect(primaryView).toContain("replaceQuery({ view: 'locations', location: id || null })")
	expect(primaryView).toContain("replaceQuery({ view: 'npcs', npc: id || null })")
	expect(primaryView).toContain("replaceQuery({ view: view === 'story' ? null : view })")
	expect(primaryView).not.toContain('location: view ===')
  })

  it('uses a draggable nested tree without geographic graph edges', () => {
    expect(locations).toContain('<LocationTreeRow')
    expect(locations).toContain('dnd-share:session-location-tree:v1:')
    expect(locations).toContain("mode === 'inside'")
    expect(locations).toContain('locationDescendantIds(sourceId')
    expect(treeRow).toContain(':draggable="editable"')
    expect(treeRow).toContain("'application/x-session-location'")
    expect(treeRow).toContain("dropMode.value = ratio < 0.27 ? 'before' : ratio > 0.73 ? 'after' : 'inside'")
    expect(locations).not.toContain('location-edge')
  })

	it('edits universal entity relationships without scenarios', () => {
	expect(locationEditor).toContain('<UniversalRelationEditor')
	expect(npcEditor).toContain('<UniversalRelationEditor')
	expect(npcEditor).toContain('relations: draft.relations')
	expect(npcs).toContain('<UniversalRelationList')
    expect(relationPicker).toContain('type="search"')
	expect(universalEditor).toContain('groupResolvedRelations')
	expect(universalPicker).toContain("{ key: 'all', label: 'Все' }")
	expect(universalPicker).toContain('Искать по всем объектам')
	expect(universalPicker).toContain('SESSION_ENTITY_TYPES')
	expect(universalPicker).toContain('creatableTypes')
	expect(universalPicker).toContain('class="entity-picker-create"')
	expect(read('../lib/sessionEntityRelations.js')).not.toContain("{ key: 'scene', label: 'Сценарии'")
	expect(quests).toContain('Связи')
  })

	it('shows canvas-derived scenario usage and opens its block canvas', () => {
	for (const workspace of [locations, npcs, quests, materials]) {
		expect(workspace).toContain('<ScenarioUsageList')
		expect(workspace).toContain('scenarioUsages')
	}
	expect(scenarioUsages).toContain('blockCount')
	expect(scenarioUsages).toContain('на холст сценария')
    expect(layer).toContain("item.type === 'scene'")
    expect(layer).toContain("emit('open-scene', item.id)")
    expect(sessionView).toContain('@open-scene="openRelatedScene"')
    expect(sessionWorkspace).toContain('async function openSceneWorkspace')
    expect(sessionWorkspace).toContain("showWorkspace('scenes', chapter, { ...graph.scenes[contextIndex], contextIndex }, 'blocks')")
  })

  it('keeps relation cards compact on wide detail views', () => {
    expect(universalList).toContain('max-width: 520px')
    expect(universalList).toContain('width: 100%')
  })

  it('keeps quest goal, condition, reward, consequences and notes separate', () => {
    for (const field of ['draft.goal', 'draft.condition', 'draft.reward', 'draft.consequences', 'draft.notes']) {
      expect(questEditor).toContain(field)
    }
    for (const label of ['Цель', 'Условие', 'Награда', 'Последствия', 'Заметки']) {
      expect(quests).toContain(label)
    }
    expect(quests).toContain("[item.name,item.goal,item.condition,item.reward,item.consequences,item.notes]")
    expect(questEditor).not.toContain('draft.description')
  })

  it('opens one grouped image catalogue from the current image preview', () => {
    expect(imagePicker).toContain('Текущее изображение')
    expect(imagePicker).toContain('Сменить')
    expect(imagePicker).toContain('v-for="category in categories"')
    expect(imagePicker).toContain('scrollIntoView')
    expect(imagePicker).toContain('.session-image-option img { width: 100%; height: auto;')
    expect(imagePicker).not.toContain('height: 112px')
    expect(imagePicker).not.toContain('role="tablist"')
    expect(npcEditor).toContain('catalog="npc"')
  })

  it('selects an NPC race from handbook items and randomizes a race-aware name', () => {
    expect(npcEditor).toContain('<FormSelect v-model:value="draft.raceItemId"')
    expect(npcEditor).toContain('itemsApi.list(8, 500)')
    expect(npcEditor).toContain('randomDndName(selectedRace.value, Math.random, draft.name)')
    expect(npcEditor).toContain('raceItemId: Number(draft.raceItemId) || null')
    expect(npcEditor).toContain('aria-label="Случайное имя"')
    expect(npcs).toContain('[npc.raceName, npc.role]')
    expect(npcs).toContain('[selectedNpc.raceName, selectedNpc.role]')
  })

  it('keeps one aggregate world state behind typed API mutations', () => {
    expect(worldState).toContain('getSessionWorld(sessionUuid)')
    expect(worldState).toContain('response?.world || response')
    expect(api).toContain('getSessionWorld')
    expect(api).toContain('/locations/${locationId}/move')
    expect(api).toContain('/npcs/${npcId}')
	expect(api).toContain('/quests/${questId}')
  })
})
