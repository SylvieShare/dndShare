import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useGraphHotkeys } from './useGraphHotkeys'

vi.mock('vue', async original => ({ ...await original(), onMounted: callback => callback(), onBeforeUnmount: vi.fn() }))
afterEach(() => vi.unstubAllGlobals())

describe('shared narrative canvas hotkey ownership', () => {
  function setup(visible) {
    let keydown
    vi.stubGlobal('window', { addEventListener: (_, callback) => { keydown = callback } })
    vi.stubGlobal('document', { querySelector: () => null, querySelectorAll: () => [] })
    const selectAll = vi.fn(), zoomBy = vi.fn(), deleteSelection = vi.fn()
    useGraphHotkeys({ enabled: true, element: { getClientRects: () => visible ? [{}] : [] },
      selectedNodes: ref([{ id: 'story-node' }]), selectAll, zoomBy, deleteSelection, clearSelection: vi.fn(), cancelGesture: vi.fn() })
    return { keydown, selectAll, zoomBy, deleteSelection }
  }
  it('does not modify a hidden story canvas while the journal tab is open', () => {
    const state = setup(false)
    state.keydown({ key: 'Delete', preventDefault: vi.fn() })
    state.keydown({ key: '+', preventDefault: vi.fn() })
    expect(state.deleteSelection).not.toHaveBeenCalled()
    expect(state.zoomBy).not.toHaveBeenCalled()
  })
  it('retains zoom keys on the visible canvas', () => {
    const state = setup(true)
    state.keydown({ key: '+', preventDefault: vi.fn() })
    expect(state.zoomBy).toHaveBeenCalledWith(1.15)
  })
})
