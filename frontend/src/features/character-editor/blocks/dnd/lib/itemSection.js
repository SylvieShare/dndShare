import { makeUid } from './itemEntry'

export const EQUIPPED_ID = 'equipped'
export const EQUIPPED_NAME = 'Экипировано'
export const DEFAULT_SECTION_NAME = 'Рюкзак'

export function makeSectionId() { return makeUid('sec') }
export function makeEntryUid() { return makeUid('item') }

function normalizeEntry(it) {
  return {
    uid: it.uid || makeEntryUid(),
    id: it.id ?? null,
    count: Math.max(1, Number(it.count) || 1),
    override: it.override && typeof it.override === 'object' ? { ...it.override } : null,
  }
}

function flattenLegacyEntries(list) {
  const out = []
  for (const s of list || []) {
    if (!s || typeof s !== 'object') continue
    out.push(normalizeEntry(s))
    if (Array.isArray(s.items) && s.items.length) {
      out.push(...flattenLegacyEntries(s.items))
    }
  }
  return out
}

/**
 * Model:
 *   {
 *     equipped: [Entry],     // hardcoded section, separate top-level field
 *     sections: [{ id, name, items: [Entry] }]   // user sections (без Рюкзак-дефолта если миграция уже была)
 *   }
 */
export function normalizeValue(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    // New shape with equipped split out
    const equippedRaw = Array.isArray(value.equipped) ? value.equipped : []
    // Backward compat: old sections-shape had equipped as a section with id 'equipped'
    let migratedEquipped = null
    let userSections = []
    if (Array.isArray(value.sections)) {
      for (const s of value.sections) {
        if (!s || typeof s !== 'object') continue
        if (s.id === EQUIPPED_ID && migratedEquipped == null) {
          migratedEquipped = (s.items || []).map(normalizeEntry)
          continue
        }
        userSections.push({
          id: s.id || makeSectionId(),
          name: typeof s.name === 'string' && s.name.trim() ? s.name : DEFAULT_SECTION_NAME,
          items: (s.items || []).map(normalizeEntry),
        })
      }
    }
    const equipped = equippedRaw.map(normalizeEntry)
    const merged = migratedEquipped ? [...equipped, ...migratedEquipped] : equipped
    if (userSections.length === 0) {
      userSections = [{ id: makeSectionId(), name: DEFAULT_SECTION_NAME, items: [] }]
    }
    return { equipped: merged, sections: userSections }
  }
  if (Array.isArray(value)) {
    return {
      equipped: [],
      sections: [{ id: makeSectionId(), name: DEFAULT_SECTION_NAME, items: flattenLegacyEntries(value) }],
    }
  }
  return {
    equipped: [],
    sections: [{ id: makeSectionId(), name: DEFAULT_SECTION_NAME, items: [] }],
  }
}

export function allCatalogIds(model) {
  const ids = new Set()
  const walk = list => { for (const it of list || []) if (it.id != null) ids.add(it.id) }
  walk(model.equipped)
  for (const sec of model.sections || []) walk(sec.items)
  return [...ids]
}

export function cloneModel(model) {
  const cloneEntry = it => ({
    uid: it.uid,
    id: it.id ?? null,
    count: it.count,
    override: it.override ? { ...it.override } : null,
  })
  return {
    equipped: (model.equipped || []).map(cloneEntry),
    sections: (model.sections || []).map(s => ({
      id: s.id,
      name: s.name,
      items: (s.items || []).map(cloneEntry),
    })),
  }
}

export function entryDisplayData(entry, catalog) {
  const base = entry.id != null ? (catalog[entry.id] || null) : null
  const ov = entry.override || {}
  const name = ov.name ?? base?.name ?? '—'
  const desc = ov.desc ?? base?.data?.desc ?? ''
  const consumable = ov.consumable ?? base?.data?.consumable ?? false
  const cost = ov.cost ?? base?.data?.cost ?? ''
  const weight = ov.weight ?? base?.data?.weight ?? null
  const isCustom = entry.id == null
  return { name, desc, consumable, cost, weight, isCustom, base }
}
