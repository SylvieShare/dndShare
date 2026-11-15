import { onBeforeUnmount, onMounted } from 'vue'
import { installCanvasPinch } from '@/shared/lib/canvasPinch'

export function useCanvasPinch(host, options) {
  let dispose
  onMounted(() => { dispose = installCanvasPinch(host.value, options) })
  onBeforeUnmount(() => dispose?.())
}
