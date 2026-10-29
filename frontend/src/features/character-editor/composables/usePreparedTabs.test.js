import { createRenderer, defineComponent, h, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { usePreparedTabs } from './usePreparedTabs'

const renderer = createRenderer({
  createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
  setText() {}, setElementText() {}, patchProp() {}, insert() {}, remove() {},
  parentNode: () => null, nextSibling: () => null,
})

afterEach(() => vi.unstubAllGlobals())
describe('prepared sheet tabs', () => {
  function setup() {
    const tasks = new Map(); let ticket = 0
    vi.stubGlobal('window', {
      requestIdleCallback(callback) { tasks.set(++ticket, callback); return ticket },
      cancelIdleCallback(id) { tasks.delete(id) },
    })
    const tabs = ref(Array.from({ length: 8 }, (_, index) => ({ id: 'tab' + index })))
    const selected = ref(0), busy = ref(false)
    let api
    const app = renderer.createApp(defineComponent({ setup() {
      api = usePreparedTabs(tabs, selected, busy)
      return () => h('div')
    } }))
    app.mount({})
    async function step() {
      const [id, callback] = tasks.entries().next().value
      tasks.delete(id); callback(); await nextTick()
    }
    return { tabs, selected, busy, app, tasks, step, api }
  }

  it('prepares every tab without visits and prioritizes a direct header selection', async () => {
    const { api, selected, app, step, tasks } = setup()
    expect(api.isReady(0)).toBe(false)
    await step()
    selected.value = 7; await nextTick(); await step()
    expect(api.isReady(7)).toBe(true)
    while (tasks.size) await step()
    expect(api.allReady.value).toBe(true)
    selected.value = 2; await nextTick()
    expect(api.allReady.value).toBe(true)
    expect(tasks.size).toBe(0)
    app.unmount()
  })

  it('defers preparation throughout a drag and cancels work when the sheet closes', async () => {
    const { api, busy, app, step, tasks } = setup()
    busy.value = true
    await step(); await step()
    expect(api.isReady(0)).toBe(false)
    busy.value = false; await step()
    expect(api.isReady(0)).toBe(true)
    app.unmount()
    expect(tasks.size).toBe(0)
  })
})
