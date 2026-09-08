import { onBeforeUnmount, ref } from 'vue'
import { JOURNAL_NODE_WIDTH, JOURNAL_NODE_HEIGHT } from '../lib/journalGraph'

// The heavy layout Worker is created only on explicit arrange, not while reading.
export function useJournalLayout() {
  const arranging = ref(false)
  let engine = null
  let worker = null
  let disposed = false
  let rejectLayout = null
  onBeforeUnmount(() => {
    disposed = true
    rejectLayout?.(new Error('Дневник закрыт'))
    engine?.terminateWorker()
  })
  async function arrange(nodes, edges) {
    if (arranging.value) return null
    arranging.value = true
    let timer = null
    const failed = new Promise((_, reject) => { rejectLayout = reject })
    failed.catch(() => {}) // Unmount can happen while the dynamic imports are pending.
    try {
      if (!engine) {
        const [{ default: ELK }, { default: workerUrl }] = await Promise.all([
          import('elkjs/lib/elk-api.js'), import('elkjs/lib/elk-worker.min.js?url'),
        ])
        if (disposed) return null
        engine = new ELK({ workerFactory: () => {
          worker = new Worker(workerUrl)
          worker.onerror = () => rejectLayout?.(new Error('Не удалось загрузить авторасстановку. Попробуйте ещё раз.'))
          return worker
        } })
      }
      timer = setTimeout(() => rejectLayout?.(new Error('Расстановка заняла слишком много времени. Попробуйте меньший раздел.')), 45_000)
      const result = await Promise.race([failed, engine.layout({
        id: 'journal',
        layoutOptions: { 'elk.algorithm': 'layered', 'elk.direction': 'UP', 'elk.spacing.nodeNode': '60', 'elk.layered.spacing.nodeNodeBetweenLayers': '64' },
        children: nodes.map(node => ({ id: node.id, width: JOURNAL_NODE_WIDTH, height: JOURNAL_NODE_HEIGHT })),
        edges: edges.map(edge => ({ id: edge.id, sources: [edge.fromId], targets: [edge.toId] })),
      })])
      return disposed ? null : result.children.map(node => ({ id: Number(node.id), positionX: node.x, positionY: node.y }))
    } catch (reason) {
      engine?.terminateWorker()
      engine = null
      worker = null
      if (!disposed) throw reason
      return null
    } finally {
      clearTimeout(timer)
      rejectLayout = null
      arranging.value = false
    }
  }
  return { arranging, arrange }
}
