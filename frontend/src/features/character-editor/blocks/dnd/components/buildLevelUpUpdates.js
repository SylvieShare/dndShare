import { resolveNumValue } from '@/shared/lib/dnd'
import { STAT_KEYS } from '@/shared/lib/dndStats'
import { castingAbilityIdOf } from '@/features/character-editor/blocks/dnd/lib/levelUp'
import { defaultSlots } from '@/features/character-editor/blocks/dnd/lib/spellEntry'
import {
  featAbilityBonuses,
  featEntry,
  featGrantedSpellIds,
  featGrants,
} from '@/features/items/lib/featRules'
import { SKILL_BY_STAT } from '@/features/character-editor/settings/dnd/creation/buildCharacter'
import {
  addHitDie,
  hitDiceFromClasses,
  withHitDice,
} from '@/features/character-editor/blocks/dnd/lib/hitDice'

export function buildLevelUpUpdates({
  values,
  newTotal,
  isPlain,
  entriesAfter,
  features,
  itemsById,
  hitDieLabelOf,
  hitDieLabel,
  hpGain,
  asiNow,
  asiSkipped,
  asiMode,
  featPick,
  suggestItems,
  asiStats,
  asiDelta,
  featureChoiceSelections,
  applySlots,
  slotDiff,
  slotsAfter,
  grantedNewIds,
  classItem,
}) {
  const updates = {
    lvl: { exp: 0, ...(values.lvl || {}), level: newTotal },
  }
  if (isPlain) return updates

  updates.classes = entriesAfter
  updates.class = { id: entriesAfter[0].id, name: entriesAfter[0].name }
  updates.subclass = entriesAfter[0].subclass ? { ...entriesAfter[0].subclass } : null

  const currentAbilities = Array.isArray(values.abilities_class) ? values.abilities_class : []
  const knownAbilityIds = new Set(currentAbilities.map((entry) => entry.id))
  const addedAbilities = features.filter((feature) => !knownAbilityIds.has(feature.id)).map((feature) => {
    const maxUse = feature.data?.max_use ?? null
    const entry = { id: feature.id, count: maxUse ?? 0 }
    if (feature.data?.manual_size) entry.max_use = maxUse ?? 0
    return entry
  })
  if (addedAbilities.length) updates.abilities_class = [...currentAbilities, ...addedAbilities]

  const hp = { ...(values.hp || {}) }
  hp.max = (Number(hp.max) || 0) + hpGain
  hp.current = Math.min(hp.max, (Number(hp.current) || 0) + hpGain)
  const classDice = entriesAfter.map((entry) => hitDieLabelOf(itemsById[entry.id]))
  updates.hp = classDice.every(Boolean)
    ? withHitDice(hp, hitDiceFromClasses(hp, entriesAfter, (entry) => hitDieLabelOf(itemsById[entry.id])))
    : addHitDie(hp, hitDieLabel || 'd8')

  let featSpellIds = []
  if (asiNow && !asiSkipped) {
    if (asiMode === 'feat' && featPick) {
      const feats = Array.isArray(values.abilities_feats) ? values.abilities_feats : []
      if (featPick.data?.repeatable || !feats.some((feat) => feat.id === featPick.id)) {
        updates.abilities_feats = [...feats, featEntry(featPick, featPick.selectedChoices || {})]
      }

      const currentStatBlock = (stat) => ({ ...(updates[stat] || values[stat] || {}) })
      const writeStatBonus = (stat, title, bonus) => {
        const block = currentStatBlock(stat)
        const oldValue = block.value
        const base = oldValue && typeof oldValue === 'object'
          ? (Number(oldValue.base) || 0)
          : (oldValue == null ? 10 : Number(oldValue) || 0)
        const bonuses = oldValue && typeof oldValue === 'object' && Array.isArray(oldValue.bonuses)
          ? oldValue.bonuses
          : []
        const applied = Math.max(0, Math.min(Number(bonus) || 0, 20 - resolveNumValue(oldValue)))
        if (applied) updates[stat] = { ...block, value: { base, bonuses: [...bonuses, { title, value: applied }] } }
      }
      for (const bonus of featAbilityBonuses(featPick, featPick.selectedChoices || {})) {
        writeStatBonus(bonus.stat, featPick.name, bonus.bonus)
      }

      const selectedChoices = featPick.selectedChoices || {}
      const grant = featGrants(featPick, selectedChoices)
      featSpellIds = featGrantedSpellIds(featPick, selectedChoices)
      const proficiencies = { ...(values.proficiencies || {}) }
      const addProficiency = (bucket, typeId, ids) => {
        if (!ids?.length) return
        const labels = [...(proficiencies[bucket] || [])]
        for (const id of ids) {
          const label = suggestItems(typeId).find((entry) => String(entry.id) === String(id))?.value
          if (label && !labels.includes(label)) labels.push(label)
        }
        proficiencies[bucket] = labels
      }
      addProficiency('Доспехи', 3, grant.armor_prof)
      addProficiency('Оружие', 4, grant.weapon_prof)
      addProficiency('Инструменты', 5, grant.tool_prof)
      addProficiency('Языки', 6, grant.languages)
      if (Object.keys(proficiencies).length) updates.proficiencies = proficiencies

      for (const skillId of (grant.skill_prof || [])) {
        const stat = SKILL_BY_STAT[String(skillId)]
        if (!stat) continue
        const block = currentStatBlock(stat)
        const saved = block.skills?.[String(skillId)] || {}
        updates[stat] = {
          ...block,
          skills: {
            ...(block.skills || {}),
            [String(skillId)]: {
              ...saved,
              up: Math.max(Number(saved.up) || 0, 1),
              override_title: saved.override_title || '',
              bonuses: saved.bonuses || [],
            },
          },
        }
      }
      for (const abilityId of (grant.save_prof || [])) {
        const stat = STAT_KEYS[Number(abilityId) - 1]
        if (stat) updates[stat] = { ...currentStatBlock(stat), save_up: true }
      }
    } else {
      for (const stat of asiStats) {
        const old = values[stat]
        const oldValue = old?.value && typeof old.value === 'object' ? old.value : { base: 10, bonuses: [] }
        const bonuses = Array.isArray(oldValue.bonuses) ? oldValue.bonuses : []
        updates[stat] = {
          ...(old && typeof old === 'object' ? old : {}),
          value: {
            base: Number(oldValue.base) || 0,
            bonuses: [...bonuses, { title: `Повышение (ур. ${newTotal})`, value: asiDelta }],
          },
        }
      }
    }
  }

  const madeChoices = Object.entries(featureChoiceSelections).filter(([, selected]) => selected.length)
  if (madeChoices.length) {
    updates.feature_choices = {
      ...(values.feature_choices && typeof values.feature_choices === 'object' ? values.feature_choices : {}),
      ...Object.fromEntries(madeChoices.map(([id, selected]) => [id, selected.slice()])),
    }
  }

  const applySlotChange = applySlots && slotDiff.length && slotsAfter?.isCaster
  if (applySlotChange || grantedNewIds.length || featSpellIds.length) {
    const spells = values.spells && typeof values.spells === 'object'
      ? { ...values.spells }
      : { stat_path: castingAbilityIdOf(classItem) ?? '', spells: [], slots: defaultSlots() }
    if (applySlotChange) {
      const slots = Array.isArray(spells.slots) && spells.slots.length
        ? spells.slots.map((slot) => ({ ...slot }))
        : defaultSlots()
      slotsAfter.totals.forEach((total, index) => {
        slots[index] = { level: index + 1, used: 0, ...(slots[index] || {}), total }
      })
      spells.slots = slots
      if (slotsAfter.pactMerged) spells.slots_rest = 'short_rest'
    }
    if (grantedNewIds.length) {
      spells.spells = [...(spells.spells || []), ...grantedNewIds.map((id) => ({ id, prepared: true }))]
    }
    if (featSpellIds.length) {
      const existing = new Set((spells.spells || []).map((entry) => String(entry.id)))
      const added = featSpellIds
        .filter((id) => !existing.has(String(id)))
        .map((id) => ({ id, prepared: true, source: 'feat' }))
      spells.spells = [...(spells.spells || []), ...added]
    }
    updates.spells = spells
  }

  return updates
}
