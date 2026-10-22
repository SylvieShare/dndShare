import { afterEach, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive, ref } from 'vue'
import { useCanvasUpdates } from './useCanvasUpdates'
vi.mock('vue', async (original) => ({
  ...(await original()),
  onMounted: () => {},
  onBeforeUnmount: () => {},
}))
vi.mock('./useMapRenderSettings', () => ({
  useMapRenderSettings: () => ({ forceLod: ref(false) }),
}))
afterEach(() => vi.unstubAllGlobals())
it('updates camera poses and hover markers without rebuilding the model scene', async () => {
  vi.stubGlobal('window', { document: { hidden: false } })
  const props = reactive({
    document: { cameras: [{ id: 'camera', view: { width: 12 } }] },
    active: true,
  })
  const renderer = {
    update: vi.fn(),
    updateCameras: vi.fn(),
    updateSelection: vi.fn(),
  }
  const scope = effectScope()
  scope.run(() => useCanvasUpdates(props, () => renderer, vi.fn(), vi.fn()))
  props.document.cameras[0].view.width = 14
  await nextTick()
  expect(renderer.updateCameras).toHaveBeenCalledOnce()
  props.hoveredCamera = 'camera'
  props.hoveredCameraPart = 'target'
  await nextTick()
  expect(renderer.updateSelection).toHaveBeenCalledOnce()
  props.previewCamera = { id: 'camera', view: { width: 16 } }
  await nextTick()
  expect(renderer.updateCameras).toHaveBeenCalledTimes(2)
  expect(renderer.update).not.toHaveBeenCalled()
  scope.stop()
})
