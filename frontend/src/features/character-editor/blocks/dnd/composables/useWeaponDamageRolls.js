import { itemEventData } from '@/features/character-editor/lib/sessionEventData'
import { ref, unref } from 'vue'
import { useDiceStore } from '@/stores/dice'
import { damageAmountActions } from '@/shared/lib/weaponDamageAmounts'
import { selectedDamageActions } from '@/shared/lib/weaponDamageOptions'
import { selectedWeaponDamageExpression } from '../lib/weaponDamageAction'
import { prepareWeaponRollEntry } from '../lib/weaponThrow'
import { weaponUseDamageActions, weaponUseDamageSelection } from '@/features/character-editor/lib/weaponUseDamage'
import { completeWeaponUseStep } from '@/features/character-editor/lib/weaponUses'
import { payWeaponUse } from '@/features/character-editor/lib/weaponUsePayment'

export function useWeaponDamageRolls(charCtx, calc) {
  const dice = useDiceStore(), error = ref('')
  const values = () => unref(charCtx.values) || {}
  function prepare(entry, { critical = false, twoHanded = false, bonusAction = false, weaponUseKey = '', actionKeys = [], actionAmounts = {} } = {}) {
    const usePlan = weaponUseKey ? calc.planWeaponUse?.(entry, weaponUseKey) : null
    if (weaponUseKey && (!usePlan || usePlan.error)) return { error: usePlan?.error || 'Применение недоступно.', expr: '' }
    const pending = usePlan ? weaponUseDamageActions({ ...values(), ...usePlan.patch }, entry.uid) : []
    if (usePlan && pending.length !== 1) return { error: 'Выберите урон только по одной цели применения.', expr: '' }
    if (pending.length) actionKeys = [...actionKeys, pending[0].key]
    const use = weaponUseDamageSelection({ ...values(), ...usePlan?.patch }, entry.uid, actionKeys)
    if (use.error) return { error: use.error, expr: '' }
    entry = prepareWeaponRollEntry(entry, calc.item(entry), calc.propertyItems(entry), calc.weaponDamageActions(entry), actionKeys)
    if (use.action) entry = { ...entry, _attackMode: use.action.prepaid.attackMode, _improvisedThrow: false }
    const bonusActionOption = !use.action && calc.bonusActionDamageOption?.(entry)
    bonusAction = !!(bonusAction && bonusActionOption)
    entry = { ...entry, _bonusActionDamage: bonusAction }
    const actions = [...pending, ...calc.weaponDamageActions(entry)]
    if (entry._attackMode === 'thrown' || bonusAction) twoHanded = false
    const baseExpression = use.action
      ? use.action.prepaid[critical ? 'criticalExpression' : 'expression']
      : critical
        ? (twoHanded ? calc.criticalDamageExpressionTwoHanded(entry, calc.extraCriticalDice(entry)) : calc.criticalDamageExpression(entry, calc.extraCriticalDice(entry)))
        : (twoHanded ? calc.damageExpressionTwoHanded(entry) : calc.damageExpression(entry))
    const primary = calc.damagePartsRaw(entry)[0] || {}
    const selectedActions = damageAmountActions(actions, actionAmounts)
    const expr = selectedWeaponDamageExpression({ baseExpression, actions: selectedActions.filter(action => !action.prepaid), actionKeys, critical, damageType: primary.type, damageTypeColor: primary.typeColor })
    return { entry, actions, selectedActions, expr, twoHanded, bonusAction, actionKeys, usePlan, use: use.action?.prepaid }
  }
  function damagePreview(entry, options) { return prepare(entry, options).expr }
  function rollDamage(entry, { critical = false, actionKeys = [], actionAmounts = {}, ...options } = {}) {
    if (!charCtx.ownerMode) return
    const roll = prepare(entry, { ...options, critical, actionKeys, actionAmounts })
    error.value = roll.error || ''
    if (!roll.expr || roll.expr === '0') return
    actionKeys = roll.actionKeys
    if (roll.usePlan) {
      error.value = payWeaponUse(charCtx, roll.usePlan, roll.actions, actionKeys, actionAmounts)
      if (error.value) return
    } else if (!calc.spend(roll.actions, actionKeys, actionAmounts)) return
    const labels = selectedDamageActions(roll.selectedActions, actionKeys).map(action => action.label || action.source_label)
    const title = `${critical ? 'Критический урон' : 'Урон'}${roll.bonusAction ? ' (бонусное действие)' : roll.twoHanded ? ' (2р)' : ''}: ${calc.itemTitle(roll.entry)}${labels.length ? ` — ${labels.join(', ')}` : ''}`
    const result = dice.roll(title, roll.expr, { minimumTotal: 0, log: !roll.use, eventData: { damageRoll: true, ...(roll.bonusAction ? { bonusAction: true } : {}), ...itemEventData({ ...calc.item(entry), id: entry.magic_item_id || entry.item_id || calc.item(entry)?.id }, entry.uid) } })
    if (roll.use) {
      charCtx.updateValues(completeWeaponUseStep(values(), entry.uid, roll.use.eventId, roll.use.stepKey, result, critical))
      charCtx.logSessionEvent?.({ type: 'dice_roll', action: title, data: { ...itemEventData({ ...calc.item(entry), id: entry.magic_item_id || entry.item_id || calc.item(entry)?.id }, entry.uid), result, damageRoll: true, weaponUseId: roll.use.eventId, stepKey: roll.use.stepKey } })
    }
    return result
  }
  return { damagePreview, rollDamage, error }
}
