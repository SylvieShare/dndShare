import { abilityOwnerLevel } from '@/shared/lib/dndAbilityUses'

function number(value) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function sourceKey(source) {
  return `${source?.kind || ''}:${source?.item_id ?? ''}`
}

export function abilitySpellGrantRows(items, values = {}) {
  const rows = []
  for (const item of items || []) {
    const data = item?.data || {}
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
  return rows
}

export function syncAbilityGrantedSpells(entries, grantRows) {
  const desired = new Map()
  for (const row of grantRows || []) {
    const key = String(row.spellId)
    if (!desired.has(key)) desired.set(key, [])
    if (!desired.get(key).some((entry) => sourceKey(entry.source) === sourceKey(row.source))) {
      desired.get(key).push(row)
    }
  }

  const result = []
  const existingIds = new Set()
  for (const raw of (Array.isArray(entries) ? entries : [])) {
    const entry = { ...raw }
    const id = String(entry.id)
    existingIds.add(id)
    const currentSources = Array.isArray(entry.granted_by) ? entry.granted_by.filter(Boolean) : []
    const retainedSources = currentSources.filter((source) => source?.kind !== 'ability')
    const wanted = desired.get(id) || []

    if (!wanted.length) {
      if (currentSources.length !== retainedSources.length && entry.external_only && !retainedSources.length) continue
      if (currentSources.length !== retainedSources.length) {
        if (retainedSources.length) entry.granted_by = retainedSources
        else delete entry.granted_by
        if (entry.casting_ability_source === 'ability') {
          delete entry.casting_ability
          delete entry.casting_ability_source
        }
        if (entry.slotless_source === 'ability') {
          delete entry.slotless
          delete entry.slotless_source
        }
        if (entry.cast_level_source === 'ability') {
          delete entry.cast_level
          delete entry.cast_level_source
        }
      }
      result.push(entry)
      continue
    }

    const abilitySources = wanted.map((row) => row.source)
    entry.granted_by = [...retainedSources, ...abilitySources]
    const castingAbility = wanted.find((row) => row.castingAbility != null)?.castingAbility
    if (castingAbility != null) {
      entry.casting_ability = castingAbility
      entry.casting_ability_source = 'ability'
    } else if (entry.casting_ability_source === 'ability') {
      delete entry.casting_ability
      delete entry.casting_ability_source
    }
    if (wanted.some((row) => row.slotless)) {
      entry.slotless = true
      entry.slotless_source = 'ability'
    } else if (entry.slotless_source === 'ability') {
      delete entry.slotless
      delete entry.slotless_source
    }
    const castLevel = wanted.find((row) => row.castLevel != null)?.castLevel
    if (castLevel != null) {
      entry.cast_level = castLevel
      entry.cast_level_source = 'ability'
    } else if (entry.cast_level_source === 'ability') {
      delete entry.cast_level
      delete entry.cast_level_source
    }
    result.push(entry)
  }

  for (const [id, wanted] of desired) {
    if (existingIds.has(id)) continue
    const castingAbility = wanted.find((row) => row.castingAbility != null)?.castingAbility
    const castLevel = wanted.find((row) => row.castLevel != null)?.castLevel
    result.push({
      id: Number(id),
      prepared: false,
      external_only: true,
      granted_by: wanted.map((row) => row.source),
      ...(castingAbility != null ? { casting_ability: castingAbility, casting_ability_source: 'ability' } : {}),
      ...(wanted.some((row) => row.slotless) ? { slotless: true, slotless_source: 'ability' } : {}),
      ...(castLevel != null ? { cast_level: castLevel, cast_level_source: 'ability' } : {}),
    })
  }
  return result
}
