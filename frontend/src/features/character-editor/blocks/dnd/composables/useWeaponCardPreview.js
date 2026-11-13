import { computed, unref } from 'vue'
import { useSuggestStore } from '@/stores/suggest'
import { weaponUseState } from '@/features/character-editor/lib/weaponUses'
import { weaponUseDamageActions } from '@/features/character-editor/lib/weaponUseDamage'
import { weaponUseRequirements } from '@/shared/lib/weaponUsePresentation'
import { weaponAttackColor, weaponAttackFormula } from '../lib/weaponAttackFormula'

export function useWeaponCardPreview(ctx, entry, preview) {
  const suggest = useSuggestStore()
  const selected = computed(() => ctx.weaponDamageActions(entry()).filter(action => action.target_choice?.selected).map(action => action.key))
  const options = computed(() => preview()?.damageKey ? { actionKeys: selected.value }
    : preview()?.options || { actionKeys: selected.value })
  const attackSummary = computed(() => ctx.weaponMenuSummary(entry(), options.value, 'attack'))
  const attackRows = computed(() => weaponAttackFormula(attackSummary.value,
    ctx.charCtx.characterDerivedEffects?.rollBonusOptions?.({ kind: 'attack' }) || [], options.value.excludedBonuses || []))
  const attackColor = computed(() => weaponAttackColor(attackSummary.value.mode))
  const damageOptions = computed(() => ({ ...options.value, weaponUseKey: '' }))
  const damageRows = computed(() => ctx.damageSources(entry(), damageOptions.value))
  const twoHandedRows = computed(() => !preview() && ctx.twoHandedParts(entry()).length
    ? ctx.damageSources(entry(), { twoHanded: true, actionKeys: selected.value }) : [])
  const alternativeDamage = computed(() => {
    const values = unref(ctx.charCtx.values) || {}, active = weaponUseState(values, entry().uid)
    const pending = weaponUseDamageActions(values, entry().uid)
    const uses = ctx.weaponUses(entry())
    const definitions = active?.status === 'active'
      ? [active, ...uses.filter(use => use.key !== active.key)] : uses
    return definitions.flatMap(use => (Array.isArray(use.steps) ? use.steps : []).map(step => {
      const key = `${encodeURIComponent(use.key)}:${encodeURIComponent(step.key)}`, isActive = active?.status === 'active' && active.key === use.key
      const type = suggest.items(12).find(row => Number(row.id) === Number(step.damage_type))
      const rule = { ...step, damage_type_label: type?.value || `Тип урона #${step.damage_type}`, damage_type_color: type?.color }
      const selectedUse = preview()?.damageKey === key || preview()?.options.weaponUseKey === use.key
      const critical = step.kind === 'weapon_damage' && (selectedUse ? !!preview().options.critical : !!step.critical)
      const action = pending.find(row => row.prepaid.stepKey === step.key)
      const error = !ctx.charCtx.ownerMode ? 'Применять оружие может владелец персонажа.'
        : isActive ? (step.status !== 'pending' ? 'Этот урон уже обработан.' : '') : use.error || ''
      return { key, title: step.title, rows: ctx.weaponUseSources(entry(), use, rule, { critical }),
        requirements: weaponUseRequirements(step, use.range_ft), error, disabled: !!error,
        selection: { key, useKey: use.key, stepKey: step.key, kind: step.kind },
        options: { critical, weaponUseKey: isActive ? '' : use.key, weaponUseStepKey: step.key,
          actionKeys: isActive && action ? [action.key] : [] } }
    }))
  })
  return { attackSummary, attackRows, attackColor, damageRows, twoHandedRows, alternativeDamage }
}
