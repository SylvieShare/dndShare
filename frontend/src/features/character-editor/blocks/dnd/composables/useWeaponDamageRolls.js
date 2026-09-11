import { ref, unref } from 'vue'
import { useDiceStore } from '@/stores/dice'
import { damageAmountActions } from '@/shared/lib/weaponDamageAmounts'
import { selectedDamageActions } from '@/shared/lib/weaponDamageOptions'
import { selectedWeaponDamageExpression } from '../lib/weaponDamageAction'
import { prepareWeaponRollEntry } from '../lib/weaponThrow'
import { weaponUseDamageSelection } from '@/features/character-editor/lib/weaponUseDamage'
import { completeWeaponUseStep } from '@/features/character-editor/lib/weaponUses'

export function useWeaponDamageRolls(charCtx, calc) {
  const dice = useDiceStore(), error = ref('')
  const values = () => unref(charCtx.values) || {}
  function prepare(entry, { critical = false, twoHanded = false, actionKeys = [], actionAmounts = {} } = {}) {
    const use = weaponUseDamageSelection(values(), entry.uid, actionKeys)
    if (use.error) return { error: use.error, expr: '' }
    entry = prepareWeaponRollEntry(entry, calc.item(entry), calc.propertyItems(entry), calc.weaponDamageActions(entry), actionKeys)
    if (use.action) entry = { ...entry, _attackMode: use.action.prepaid.attackMode, _improvisedThrow: false }
    const actions = calc.weaponDamageActions(entry)
    if (entry._attackMode === 'thrown') twoHanded = false
    const baseExpression = use.action
      ? use.action.prepaid[critical ? 'criticalExpression' : 'expression']
      : critical
        ? (twoHanded ? calc.criticalDamageExpressionTwoHanded(entry, calc.extraCriticalDice(entry)) : calc.criticalDamageExpression(entry, calc.extraCriticalDice(entry)))
        : (twoHanded ? calc.damageExpressionTwoHanded(entry) : calc.damageExpression(entry))
    const primary = calc.damagePartsRaw(entry)[0] || {}
    const selectedActions = damageAmountActions(actions, actionAmounts)
    const expr = selectedWeaponDamageExpression({ baseExpression, actions: selectedActions.filter(action => !action.prepaid), actionKeys, critical, damageType: primary.type, damageTypeColor: primary.typeColor })
    return { entry, actions, selectedActions, expr, twoHanded, use: use.action?.prepaid }
  }
  function damagePreview(entry, options) { return prepare(entry, options).expr }
  function rollDamage(entry, { critical = false, actionKeys = [], actionAmounts = {}, ...options } = {}) {
    if (!charCtx.ownerMode) return
    const roll = prepare(entry, { ...options, critical, actionKeys, actionAmounts })
    error.value = roll.error || ''
    if (!roll.expr || roll.expr === '0') return
    if (!calc.spend(roll.actions, actionKeys, actionAmounts)) return
    const labels = selectedDamageActions(roll.selectedActions, actionKeys).map(action => action.label || action.source_label)
    const title = `${critical ? 'Критический урон' : 'Урон'}${roll.twoHanded ? ' (2р)' : ''}: ${calc.itemTitle(roll.entry)}${labels.length ? ` — ${labels.join(', ')}` : ''}`
    const result = dice.roll(title, roll.expr, { log: !roll.use })
    if (roll.use) {
      charCtx.updateValues(completeWeaponUseStep(values(), entry.uid, roll.use.eventId, roll.use.stepKey, result, critical))
      charCtx.logSessionEvent?.({ type: 'dice_roll', action: title, data: { result, weaponUseId: roll.use.eventId, stepKey: roll.use.stepKey } })
    }
    return result
  }
  return { damagePreview, rollDamage, error }
}
