import { nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { useGraphSelection } from './useGraphSelection'

describe('graph selection', () => {
  it('toggles independent nodes and clears the whole selection', () => {
    const nodes = ref([{ id: 1 }, { id: 2 }, { id: 3 }])
    const onChange = vi.fn()
    const selection = useGraphSelection(() => nodes.value, onChange)

    selection.toggleSelection(nodes.value[0])
    selection.toggleSelection(nodes.value[2])
    expect(selection.selectedNodes.value.map(node => node.id)).toEqual([1, 3])
    expect(onChange).toHaveBeenLastCalledWith([1, 3])

    selection.clearSelection()
    expect(selection.selectedNodes.value).toEqual([])
    expect(onChange).toHaveBeenLastCalledWith([])
  })

  it('forgets selected nodes removed from the active graph', async () => {
    const nodes = ref([{ id: 1 }, { id: 2 }])
    const onChange = vi.fn()
    const selection = useGraphSelection(() => nodes.value, onChange)
    selection.toggleSelection(nodes.value[0])
    selection.toggleSelection(nodes.value[1])

    nodes.value = [{ id: 2 }]
    await nextTick()

    expect(selection.selectedNodes.value.map(node => node.id)).toEqual([2])
    expect(onChange).toHaveBeenLastCalledWith([2])
  })

  it('adds every node intersecting a modifier-drag frame', () => {
    const nodes = ref([
      { id: 1, positionX: 20, positionY: 20 },
      { id: 2, positionX: 180, positionY: 20 },
      { id: 3, positionX: 420, positionY: 20 },
    ])
    const selection = useGraphSelection(() => nodes.value, vi.fn())
    selection.toggleSelection(nodes.value[2])
    const event = { pointerId: 7, clientX: 0, clientY: 0 }
    const pointInWorld = value => ({ x: value.clientX, y: value.clientY })
    const active = selection.beginFrameSelection(event, null, pointInWorld, { left: 0, top: 0 })

    selection.updateFrameSelection(active, { clientX: 300, clientY: 160 }, pointInWorld, () => ({ width: 100, height: 100 }))

    expect(selection.selectedNodes.value.map(node => node.id)).toEqual([1, 2, 3])
    expect(selection.selectionFrameStyle.value).toEqual({ left: '0px', top: '0px', width: '300px', height: '160px' })
    selection.finishFrameSelection(active)
    expect(selection.selectionFrameStyle.value).toBeNull()
  })
})
