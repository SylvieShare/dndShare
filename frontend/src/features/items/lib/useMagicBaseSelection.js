import { computed, reactive } from 'vue'
import { baseParamKey, magicEquipmentKinds, magicBaseParams, eligibleMagicBase } from './magicEquipmentBases'
export function useMagicBaseSelection(item, params = {}) {
  const kinds = computed(() => magicEquipmentKinds(item.value))
  const chosen = reactive(magicBaseParams(item.value, params)), options = reactive({})
  function loaded(kind, rows) {
    options[kind] = rows.filter(base => eligibleMagicBase(item.value, base, kind))
    if (options[kind].length === 1) chosen[baseParamKey(kind)] = options[kind][0].id
  }
  const complete = computed(() => kinds.value.every(kind => options[kind]?.some(base => Number(base.id) === Number(chosen[baseParamKey(kind)]))))
  const result = () => complete.value ? magicBaseParams(item.value, chosen) : null
  return { kinds, chosen, loaded, complete, result }
}
