import { effectScope, reactive, watch } from 'vue'
import { expect, it, vi } from 'vitest'
import { useSessionPrimaryView } from './useSessionPrimaryView'

it('publishes the location target before the catalogue can select its first record', async () => {
  const route = reactive({ query: { view: 'globalMaps' } })
  const router = { replace: vi.fn(async ({ query }) => {
    await Promise.resolve()
    route.query = query
  }) }
  const scope = effectScope(), seen = []
  const view = scope.run(() => {
    const view = useSessionPrimaryView({ sessionUuid: 'test', route, router })
    watch(view.activeView, active => {
      if (active === 'locations') seen.push(view.selectedLocationId.value)
    }, { flush: 'sync' })
    return view
  })
  await view.selectLocation(22)
  expect(seen).toEqual([22])
  expect(view.activeView.value).toBe('locations')
  expect(view.selectedLocationId.value).toBe(22)
  scope.stop()
})
