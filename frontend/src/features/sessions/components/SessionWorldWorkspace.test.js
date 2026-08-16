import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import SessionLocationsWorkspace from './SessionLocationsWorkspace.vue'
import SessionNpcsWorkspace from './SessionNpcsWorkspace.vue'
import SessionWorldLayer from './SessionWorldLayer.vue'

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
const primaryView = read('../composables/useSessionPrimaryView.js')
const worldState = read('../composables/useSessionWorld.js')
const api = read('../../../shared/api/sessionsApi.js')

describe('session world workspaces', () => {
  it('compiles all central world modes', () => {
    expect(SessionWorldLayer).toBeTruthy()
    expect(SessionLocationsWorkspace).toBeTruthy()
    expect(SessionNpcsWorkspace).toBeTruthy()
  })

  it('switches the central workspace from the semantic session header', () => {
    expect(toolbar).toContain('aria-label="Раздел сессии"')
    expect(toolbar).toContain("{ key: 'story', label: 'Сюжет'")
    expect(toolbar).toContain("{ key: 'locations', label: 'Локации'")
    expect(toolbar).toContain("{ key: 'npcs', label: 'NPC'")
    expect(graphTab).toContain('v-show="primaryView === \'story\'"')
    expect(graphTab).toContain('<slot v-if="primaryView !== \'story\'" name="primary-workspace" />')
    expect(layer).toContain("activeView === 'locations'")
    expect(layer).toContain("activeView === 'npcs'")
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
    expect(primaryView).toContain("replaceQuery({ view: 'locations', location: id || null, npc: null })")
    expect(primaryView).toContain("replaceQuery({ view: 'npcs', npc: id || null, location: null })")
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

  it('edits scenario-location and NPC relationships from focused editors', () => {
    expect(locationEditor).toContain('Сценарии в этой локации')
    expect(locationEditor).toContain('sceneIds: draft.sceneIds')
    expect(npcEditor).toContain('Где его можно встретить')
    expect(npcEditor).toContain('locationIds: draft.locationIds')
    expect(npcEditor).toContain('sceneIds: draft.sceneIds')
    expect(npcs).toContain('Где встретить')
    expect(npcs).toContain('Участие в сюжете')
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
  })
})
