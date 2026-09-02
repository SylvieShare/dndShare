import { abilityOwnerLevel } from '@/shared/lib/dndAbilityUses'
import { itemChoices } from '@/features/items/lib/itemChoices'

function number(value) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function sourceKey(source) {
  return `${source?.kind || ''}:${source?.item_id ?? ''}`
}

function grantKey(spellId, source) {
  return `${sourceKey(source)}:spell:${spellId}`
}

function choiceOption(item, choiceKey, selectedValue) {
  const choice = itemChoices(item).find((row) => row.key === choiceKey)
  return (choice?.options || []).find((option) => String(option.value ?? option.label) === String(selectedValue)) || null
}

function choiceCastingAbility(item, ownedEntry, choice) {
  const fixed = number(choice.casting_ability)
  if (fixed != null) return fixed
  const sourceKey = choice.casting_ability_choice_key
  const selected = sourceKey && ownedEntry?.choices?.[sourceKey]?.[0]
  return number(choiceOption(item, sourceKey, selected)?.casting_ability)
}

export function abilitySpellGrantRows(items, values = {}) {
  const rows = []
  for (const item of items || []) {
    const data = item?.data || {}
    const ownedEntry = ['abilities_race', 'abilities_class', 'abilities_feats']
      .flatMap((key) => Array.isArray(values?.[key]) ? values[key] : [])
      .find((entry) => String(entry?.id) === String(item.id))
    if (ownedEntry?.requirements_met === false) continue
    const ownerLevel = abilityOwnerLevel(data, values)
    for (const rule of (Array.isArray(data.granted_spells) ? data.granted_spells : [])) {
      const spellId = number(rule?.spell?.id ?? rule?.spell)
      const unlockLevel = number(rule?.level) ?? number(data.level) ?? 1
      if (spellId == null || ownerLevel < unlockLevel) continue
      const castingAbility = number(rule?.ability)
      const castLevel = number(rule?.cast_level)
      rows.push({
        spellId,
        castingAbility,
        castLevel,
        slotless: !!rule?.slotless,
        countsAsKnown: !!rule?.counts_as_known,
        source: {
          kind: 'ability',
          item_id: item.id,
          label: item.name || 'Способность',
          ...(castingAbility != null ? { casting_ability: castingAbility } : {}),
          ...(castLevel != null ? { cast_level: castLevel } : {}),
        },
      })
    }
    for (const choice of itemChoices(item).filter((rule) => rule.grant_spells)) {
      const unlockLevel = number(choice.level) ?? number(data.level) ?? 1
      if (ownerLevel < unlockLevel) continue
      for (const selected of (Array.isArray(ownedEntry?.choices?.[choice.key]) ? ownedEntry.choices[choice.key] : [])) {
        const spellId = number(selected)
        if (spellId == null) continue
        const castingAbility = choiceCastingAbility(item, ownedEntry, choice)
        const castLevel = number(choice.cast_level)
        rows.push({
          spellId,
          castingAbility,
          castLevel,
          slotless: !!choice.slotless,
          countsAsKnown: !!choice.counts_as_known,
          source: {
            kind: 'ability',
            item_id: item.id,
            label: item.name || 'Способность',
            ...(castingAbility != null ? { casting_ability: castingAbility } : {}),
            ...(castLevel != null ? { cast_level: castLevel } : {}),
          },
        })
      }
    }
  }
  return rows
}

export function syncAbilityGrantedSpells(grants, grantRows) {
  const retained = (Array.isArray(grants) ? grants : [])
    .filter((entry) => entry?.source?.kind !== 'ability')
    .map((entry) => ({ ...entry, source: entry.source ? { ...entry.source } : {} }))
  const desired = new Map()
  for (const row of grantRows || []) {
    const key = grantKey(row.spellId, row.source)
    if (desired.has(key)) continue
    desired.set(key, {
      key,
      id: Number(row.spellId),
      source: { ...row.source },
      ...(row.castingAbility != null ? { casting_ability: row.castingAbility } : {}),
      ...(row.castLevel != null ? { cast_level: row.castLevel } : {}),
      ...(row.slotless ? { slotless: true } : {}),
      ...(row.countsAsKnown ? { counts_as_known: true } : {}),
    })
  }
  return [...retained, ...desired.values()]
}
