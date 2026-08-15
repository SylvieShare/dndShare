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
})
