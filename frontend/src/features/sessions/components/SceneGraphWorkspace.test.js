import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import SceneBlockGraphWorkspace from './SceneBlockGraphWorkspace.vue'
import SceneGraphWorkspace from './SceneGraphWorkspace.vue'

const sceneSource = readFileSync(fileURLToPath(new URL('./SceneGraphWorkspace.vue', import.meta.url)), 'utf8')
const blockSource = readFileSync(fileURLToPath(new URL('./SceneBlockGraphWorkspace.vue', import.meta.url)), 'utf8')
const canvasSource = readFileSync(fileURLToPath(new URL('./NestedGraphCanvas.vue', import.meta.url)), 'utf8')
const apiSource = readFileSync(fileURLToPath(new URL('../../../shared/api/scenesApi.js', import.meta.url)), 'utf8')

describe('nested session graphs', () => {
  it('compiles both nested workspaces', () => {
    expect(SceneGraphWorkspace).toBeTruthy()
    expect(SceneBlockGraphWorkspace).toBeTruthy()
  })

  it('drills from scenarios into a block canvas and keeps the selected scenario in the header', () => {
    expect(sceneSource).toContain("const depth = ref('scenes')")
    expect(sceneSource).toContain("depth.value = 'blocks'")
    expect(sceneSource).toContain(':spotlight-node-id="depth === \'blocks\' ? selectedScene?.id : null"')
    expect(sceneSource).toContain('<SceneBlockGraphWorkspace')
    expect(sceneSource).toContain('class="scene-graph-chapter-hit"')
    expect(blockSource).toContain('left: 504px;')
  })

  it('supports independent positions and directed links on both levels', () => {
    expect(sceneSource).toContain('from-key="fromSceneId"')
    expect(sceneSource).toContain('@preview-position="graph.setLocalPosition"')
    expect(blockSource).toContain('from-key="fromItemId"')
    expect(blockSource).toContain('@finish-link="finishLink"')
    expect(canvasSource).toContain('class="nested-graph-edge-line"')
    expect(canvasSource).toContain('class="nested-graph-link-port"')
    expect(apiSource).toContain('getSceneGraph')
    expect(apiSource).toContain('getSceneBlockGraph')
    expect(apiSource).toContain('createSceneBlockEdge')
  })
})
