import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { inventoryQuantityDelta } from '../lib/inventoryMotion'
import { useInventoryAnimation } from './useInventoryAnimation'

export function useInventoryQuantityMotion(element, props) {
  const motion = useInventoryAnimation(), feedback = ref(null)
  let sequence = 0
  watch(() => ({ key: props.itemKey, count: props.count }), async (next, previous) => {
    if (String(next.key) !== String(previous.key)) {
      sequence++; feedback.value = null; motion.stop()
      return
    }
    const amount = inventoryQuantityDelta(previous, next)
    if (!amount || motion.reduced.value || props.source) return
    const token = ++sequence
    motion.stop()
    feedback.value = { amount, token }
    await nextTick()
    if (token !== sequence) return
    const root = element.value, kind = amount > 0 ? 'add-one' : 'remove-one'
    motion.run(root?.querySelector('.inventory-bag-item__art'), [
      { transform: 'scale(1)' },
      { transform: amount > 0 ? 'scale(1.07)' : 'scale(.94)' },
      { transform: 'scale(1)' },
    ], { kind, duration: 220 })
    motion.run(root?.querySelector('.inventory-bag-item__count'), [
      { transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' },
    ], { kind: `${kind}-count`, duration: 220 })
    const finish = () => { if (feedback.value?.token === token) feedback.value = null }
    const animation = motion.run(root?.querySelector('.inventory-bag-item__feedback'), [
      { opacity: 0, transform: 'translateY(4px)', offset: 0 },
      { opacity: 1, transform: 'translateY(0)', offset: .2 },
      { opacity: 0, transform: 'translateY(-18px)', offset: 1 },
    ], { kind: `${kind}-feedback`, duration: 480, onFinish: finish })
    if (!animation) finish()
  }, { flush: 'post' })
  onBeforeUnmount(() => { sequence++; feedback.value = null })
  return feedback
}
