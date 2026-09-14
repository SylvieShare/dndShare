import { createApp, h, ref, nextTick } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory, RouterView } from 'vue-router'
import { useAccountStore } from '../../src/stores/account'
import { clickOutside } from '../../src/shared/lib/clickOutside'
import ViewCharacter from '../../src/features/character-editor/pages/ViewCharacter.vue'
import HandbookItemList from '../../src/features/handbook/components/HandbookItemList.vue'
import * as snapshots from '../../src/features/character-editor/lib/characterSnapshots'
import '@sylvieshare/share-ui/styles.css'

const frame = () => new Promise(resolve => requestAnimationFrame(resolve))
const settle = async () => { await nextTick(); await frame(); await frame() }
const mode = new URLSearchParams(location.search).get('mode') || 'list'
const pinia = createPinia()
const account = useAccountStore(pinia)
account.status = 'success'
account.user = { id: 1, roles: [], login: 'Performance fixture' }
const items = ref([])
const type = { id: 2, name: 'Предметы', fields: [] }
const makeItems = count => Array.from({ length: count }, (_, i) => ({ id: i + 1, typeId: 2, name: `Предмет ${i + 1}`, data: {} }))
window.frontendBenchmark = {
  async setCount(count) { items.value = makeItems(count); await settle() },
  async snapshots() {
    const data = { values: { name: 'Персонаж', items: makeItems(250).map(item => ({ ...item, desc: 'Описание '.repeat(60) })) }, var: {} }
    let writes = 0, callMs = 0
    const storage = { getItem: key => localStorage.getItem(key), setItem: (key, value) => { writes++; localStorage.setItem(key, value) } }
    const key = snapshots.characterSnapshotStorageKey('benchmark')
    localStorage.removeItem(key)
    // Both versions exercise their real snapshot entry point; the original
    // version records immediately, the optimized version schedules a batch.
    const factory = Reflect.get(snapshots, 'createCharacterSnapshotRecorder')
    const recorder = factory?.('benchmark', () => data, { storage })
    for (let i = 0; i < 50; i++) {
      data.values.name = `Персонаж ${i}`
      const start = performance.now()
      if (recorder) recorder.schedule()
      else Reflect.get(snapshots, 'recordCharacterSnapshot')('benchmark', data, storage)
      callMs += performance.now() - start
      await new Promise(resolve => setTimeout(resolve, 5))
    }
    const start = performance.now()
    recorder?.flush()
    const flushMs = performance.now() - start
    const saved = JSON.parse(localStorage.getItem(key))
    const result = { writes, callMs, flushMs, dataBytes: new TextEncoder().encode(JSON.stringify(data)).length, finalName: saved.at(-1).values.name }
    recorder?.dispose()
    localStorage.removeItem(key)
    return result
  },
}

if (mode === 'character') {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/char/:uuid', name: 'Character', component: ViewCharacter }] })
  await router.push('/char/benchmark')
  await router.isReady()
  createApp({ render: () => h(RouterView) }).use(pinia).use(router).directive('click-outside', clickOutside).mount('#app')
} else {
  createApp({ render: () => h('main', { style: 'height:640px;display:flex;flex-direction:column;width:800px;max-width:100vw' }, [h(HandbookItemList, { style: 'flex:1;min-height:0', items: items.value, type })]) }).use(pinia).mount('#app')
}
