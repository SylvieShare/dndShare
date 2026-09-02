export const SPELLBOOK_SCHEMA_VERSION = 2
export const SPELL_TAB_MODES = ['known', 'prepared', 'spellbook']

let fallbackSequence = 0

export function createSpellbookKey(prefix = 'spell') {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return `${prefix}:${uuid}`
  fallbackSequence += 1
  return `${prefix}:${Date.now().toString(36)}:${fallbackSequence.toString(36)}`
}

export function normalizedClassItemId(value) {
  if (value == null || value === '') return null
  const parsed = Number(value?.id ?? value)
  return Number.isFinite(parsed) ? parsed : null
}

export function spellTabMode(value) {
  return SPELL_TAB_MODES.includes(value) ? value : 'known'
}

export function classSpellTabKey(classItemId) {
  return `class:${normalizedClassItemId(classItemId) ?? ''}`
}

export function spellEntry(itemId, values = {}) {
  return {
    key: values.key || createSpellbookKey('spell'),
    id: Number(itemId),
    prepared: !!values.prepared,
  }
}

export function spellTab(values = {}) {
  return {
    key: values.key || createSpellbookKey('tab'),
    name: String(values.name || 'Магия').trim() || 'Магия',
    class_item_id: normalizedClassItemId(values.class_item_id),
    casting_ability: values.casting_ability ?? '',
    mode: spellTabMode(values.mode),
    save_bonus: Number(values.save_bonus) || 0,
    attack_bonus: Number(values.attack_bonus) || 0,
    spells: (Array.isArray(values.spells) ? values.spells : []).map((entry) => spellEntry(entry.id, entry)),
  }
}

export function normalizedSpellTabs(values) {
  const usedClassItemIds = new Set()
  return (Array.isArray(values) ? values : []).map((value) => {
    const tab = spellTab(value)
    if (tab.class_item_id == null) return tab
    const key = String(tab.class_item_id)
    if (usedClassItemIds.has(key)) tab.class_item_id = null
    else usedClassItemIds.add(key)
    return tab
  })
}

export function grantedSpell(values = {}) {
  return {
    key: values.key || createSpellbookKey('grant'),
    id: Number(values.id),
    source: values.source && typeof values.source === 'object' ? { ...values.source } : {},
    ...(values.tab_key ? { tab_key: values.tab_key } : {}),
    ...(values.casting_ability != null ? { casting_ability: values.casting_ability } : {}),
    ...(values.cast_level != null ? { cast_level: Number(values.cast_level) } : {}),
    ...(values.slotless ? { slotless: true } : {}),
    ...(values.counts_as_known ? { counts_as_known: true } : {}),
  }
}

export function emptySpellbook(values = {}) {
  return {
    schema_version: SPELLBOOK_SCHEMA_VERSION,
    slots_auto: values.slots_auto !== false,
    slot_pools: values.slot_pools || { long_rest: [], short_rest: [] },
    tabs: normalizedSpellTabs(values.tabs),
    grants: (Array.isArray(values.grants) ? values.grants : []).map(grantedSpell),
  }
}

export function findClassSpellTab(tabs, classItemId) {
  const id = normalizedClassItemId(classItemId)
  if (id == null) return null
  return (Array.isArray(tabs) ? tabs : []).find((tab) => normalizedClassItemId(tab?.class_item_id) === id) || null
}

export function spellTabFromClass(classItem, rules, values = {}) {
  const classItemId = normalizedClassItemId(classItem)
  return spellTab({
    key: values.key || classSpellTabKey(classItemId),
    name: values.name || classItem?.name || classItem?.nameEn || 'Магия',
    class_item_id: classItemId,
    casting_ability: values.casting_ability ?? rules?.ability ?? classItem?.data?.spellcasting_ability ?? '',
    mode: values.mode || rules?.selectionMode || (rules?.prepares ? 'prepared' : 'known'),
    save_bonus: values.save_bonus,
    attack_bonus: values.attack_bonus,
    spells: values.spells,
  })
}

export function spellbookItemIds(book) {
  return [...new Set([
    ...(Array.isArray(book?.tabs) ? book.tabs : []).flatMap((tab) => (tab.spells || []).map((entry) => entry.id)),
    ...(Array.isArray(book?.grants) ? book.grants : []).map((entry) => entry.id),
  ].filter((id) => id != null))]
}

export function spellbookEntries(book) {
  const entries = []
  for (const tab of (Array.isArray(book?.tabs) ? book.tabs : [])) {
    for (const entry of (Array.isArray(tab?.spells) ? tab.spells : [])) entries.push({ ...entry, tab_key: tab.key })
  }
  for (const entry of (Array.isArray(book?.grants) ? book.grants : [])) entries.push({ ...entry, granted: true })
  return entries
}

export function slotPoolsFromComputation(computation) {
  const longRest = (computation?.totals || []).map((total, index) => ({
    level: index + 1,
    total: Number(total) || 0,
    used: 0,
  })).filter((slot) => slot.total > 0)
  const shortRest = computation?.pact
    ? [{ level: computation.pact.slotLevel, total: computation.pact.count, used: 0 }]
    : []
  return { long_rest: longRest, short_rest: shortRest }
}

export function mergeComputedSlotPools(current, computation) {
  const required = slotPoolsFromComputation(computation)
  return Object.fromEntries(['long_rest', 'short_rest'].map((rest) => {
    const existing = new Map((Array.isArray(current?.[rest]) ? current[rest] : [])
      .map((slot) => [Number(slot.level), slot]))
    return [rest, required[rest].map((slot) => ({
      ...slot,
      used: Math.min(slot.total, Math.max(0, Number(existing.get(slot.level)?.used) || 0)),
    }))]
  }))
}
