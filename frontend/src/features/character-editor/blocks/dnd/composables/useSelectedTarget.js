import { computed, unref } from 'vue'
import { selectedTargets, changeSelectedTarget } from '@/features/character-editor/lib/selectedTarget'

export function useSelectedTarget(charCtx, uid) {
  const values = () => unref(charCtx.values) || {}
  const items = () => unref(charCtx.characterResources?.itemsById) || new Map()
  const source = computed(() => selectedTargets(values(), items()).find(row => row.uid === unref(uid)))
  function change(operation, payload) {
    const patch = changeSelectedTarget(values(), items(), unref(uid), operation, payload, !!charCtx.ownerMode)
    if (!Object.keys(patch).length) return false
    charCtx.updateValues(patch)
    if (operation !== 'select') charCtx.logSessionEvent?.({ type: 'feature_state', action: `${source.value?.item.name || 'Предмет'}: ${operation === 'declare' ? 'объявлена цель' : operation === 'defeat' ? 'цель погибла' : 'исправлен выбор цели'}`, data: { instanceUid: unref(uid), operation } })
    return true
  }
  return { source, change }
}
