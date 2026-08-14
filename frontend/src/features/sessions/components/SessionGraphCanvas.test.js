import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import SessionGraphCanvas from './SessionGraphCanvas.vue'

const source = readFileSync(fileURLToPath(new URL('./SessionGraphCanvas.vue', import.meta.url)), 'utf8')
const canvasSource = readFileSync(fileURLToPath(new URL('./NestedGraphCanvas.vue', import.meta.url)), 'utf8')
const dockSource = readFileSync(fileURLToPath(new URL('./CanvasActionDock.vue', import.meta.url)), 'utf8')
const apiSource = readFileSync(fileURLToPath(new URL('../../../shared/api/scenesApi.js', import.meta.url)), 'utf8')

describe('session graph canvas', () => {
  it('compiles one persistent canvas host', () => {
    expect(SessionGraphCanvas).toBeTruthy()
    expect(source.match(/<NestedGraphCanvas/g)).toHaveLength(1)
    expect(source).toContain(':nodes="activeNodes"')
    expect(source).toContain(':edges="activeEdges"')
  })

  it('drills through scenarios and blocks while keeping ancestors as cards', () => {
    expect(source).toContain("displayLevel.value = 'scenes'")
    expect(source).toContain("displayLevel.value = 'blocks'")
    expect(source).toContain('spotlightOffsetX.value = 252')
    expect(source).toContain('class="session-graph-ancestor session-graph-ancestor--chapter"')
    expect(source).toContain('class="session-graph-ancestor session-graph-ancestor--scene"')
  })

  it('places contextual creation actions on the center-right of the canvas', () => {
    expect(source).toContain('<CanvasActionDock')
    expect(source).toContain("label: 'Новая глава'")
    expect(source).toContain("label: 'Новый сценарий'")
    expect(source).toContain("label: 'Текстовый блок'")
    expect(dockSource).toContain('top: 50%;')
    expect(dockSource).toContain('right: calc(var(--chapter-safe-right, 0px) + 16px);')
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
})
