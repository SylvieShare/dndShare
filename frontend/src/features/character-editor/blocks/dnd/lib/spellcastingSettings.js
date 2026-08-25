export const OTHER_SPELLCASTING_SOURCE = 'other'

function number(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function sourceFor(key, sources) {
  return (Array.isArray(sources) ? sources : []).find((source) => source?.key === key) || null
}

function defaultsFor(key, sources) {
  const source = sourceFor(key, sources)
  return {
    stat_path: source?.ability ?? '',
    save_bonus: 0,
    attack_bonus: 0,
    preparation: !!source?.prepares,
  }
}

function normalizeSetting(value, defaults) {
  const row = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  return {
    stat_path: row.stat_path ?? defaults.stat_path,
    save_bonus: number(row.save_bonus ?? defaults.save_bonus),
    attack_bonus: number(row.attack_bonus ?? defaults.attack_bonus),
    preparation: row.preparation == null ? defaults.preparation : !!row.preparation,
  }
}

export function spellcastingSetting(settings, key, sources) {
  return normalizeSetting(settings?.[key], defaultsFor(key, sources))
}

/** Convert the former spellbook-wide parameters into independent source rows. */
export function loadSpellcastingSettings(raw, sources) {
  const canonical = raw?.source_settings
  if (canonical && typeof canonical === 'object' && !Array.isArray(canonical)) {
    return Object.fromEntries(Object.entries(canonical)
      .map(([key, value]) => [key, normalizeSetting(value, defaultsFor(key, sources))]))
  }

  const legacy = {
    stat_path: raw?.stat_path ?? '',
    save_bonus: number(raw?.save_bonus),
    attack_bonus: number(raw?.attack_bonus),
    preparation: !!raw?.preparation,
  }
  const result = { [OTHER_SPELLCASTING_SOURCE]: legacy }
  for (const source of (Array.isArray(sources) ? sources : [])) {
    result[source.key] = {
      stat_path: source.ability ?? legacy.stat_path,
      save_bonus: legacy.save_bonus,
      attack_bonus: legacy.attack_bonus,
      preparation: !!source.prepares,
    }
  }
  return result
}

export function serializeSpellcastingSettings(settings, sources) {
  const keys = new Set([
    ...Object.keys(settings && typeof settings === 'object' ? settings : {}),
    ...(Array.isArray(sources) ? sources.map((source) => source.key) : []),
    OTHER_SPELLCASTING_SOURCE,
  ])
  return Object.fromEntries([...keys].map((key) => [key, spellcastingSetting(settings, key, sources)]))
}
