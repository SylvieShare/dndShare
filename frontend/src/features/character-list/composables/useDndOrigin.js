import { computed } from 'vue'
import { dndRules, originAbilityBonuses, backgroundAbilities } from '@/shared/lib/dndRules'
import { choiceSelectionsComplete } from '@/features/items/lib/itemChoices'

export function useDndOrigin(state, featPool) {
  const originRules = computed(() => dndRules(state.version))
  const originAbilities = computed(() => backgroundAbilities(state.background))
  const originBonuses = computed(() => originAbilityBonuses(state.version, originAbilities.value, state.backgroundAsi))
  const originFeat = computed(() => {
    const item = featPool.value.find(item => Number(item.id) === Number(state.background?.data?.origin_feat_id || state.originFeatId))
    if (!item) return null
    const classId = Number(state.background?.data?.origin_feat_class_id)
    return !classId ? item : { ...item, data: { ...item.data, choices: (item.data?.choices || []).map(choice => choice.key === 'magic_class' ? { ...choice, options: choice.options.filter(option => Number(option.value) === classId) } : choice) } }
  })
  const originUnique = computed(() => {
    const feat = originFeat.value
    if (!feat || !(state.featIds || []).some(id => Number(id) === Number(feat.id))) return true
    if (!feat.data?.repeatable) return false
    const other = state.featSelections?.[feat.id]?.magic_class?.[0]
    const own = state.originFeatChoices?.magic_class?.[0]
    return !feat.data?.choices?.some(choice => choice.key === 'magic_class') || (other != null && own != null && String(other) !== String(own))
  })
  const originFeatOptions = computed(() => featPool.value.filter(item => item.data?.category === 'origin'))
  function selectOriginFeat(item) {
    if (!item?.id || item.data?.category !== 'origin') return false
    const existing = featPool.value.findIndex(feat => Number(feat.id) === Number(item.id))
    if (existing < 0) featPool.value = [...featPool.value, item]
    else featPool.value = featPool.value.map((feat, index) => index === existing ? item : feat)
    state.originFeatId = Number(item.id)
    state.originFeatChoices = {}
    return true
  }
  const originComplete = computed(() => !originRules.value.originFeatRequired || (!!originBonuses.value && originUnique.value && !!originFeat.value && originFeat.value.data?.category === 'origin' && choiceSelectionsComplete(originFeat.value, state.originFeatChoices)))
  return { originRules, originAbilities, originBonuses, originFeat, originFeatOptions, originComplete, selectOriginFeat }
}
