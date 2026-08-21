import { makeUid } from './itemEntry'
import { instanceDisplayName } from '@/features/items/lib/itemInstance'

export const EQUIPPED_ID = 'equipped'
export const EQUIPPED_NAME = 'Экипировано'
export const DEFAULT_SECTION_NAME = 'Рюкзак'

export function makeSectionId() { return makeUid('sec') }
export function makeEntryUid() { return makeUid('item') }

function normalizeEntry(it) {
  return {
    uid: it.uid || makeEntryUid(),
    item_id: it.item_id ?? null,
    count: Math.max(1, Number(it.count) || 1),
    params: it.params && typeof it.params === 'object' && !Array.isArray(it.params) ? { ...it.params } : {},
    override: it.override && typeof it.override === 'object' ? { ...it.override } : null,
  }
}

/**
 * Model:
 *   {
 *     equipped: [Entry],     // hardcoded section, separate top-level field
 *     sections: [{ id, name, items: [Entry] }]   // user sections (без Рюкзак-дефолта если миграция уже была)
 *   }
 */
export function normalizeValue(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const equipped = Array.isArray(source.equipped) ? source.equipped.map(normalizeEntry) : []
  const sections = Array.isArray(source.sections)
    ? source.sections.filter(s => s && typeof s === 'object').map(s => ({
        id: s.id || makeSectionId(),
        name: typeof s.name === 'string' && s.name.trim() ? s.name : DEFAULT_SECTION_NAME,
        items: Array.isArray(s.items) ? s.items.map(normalizeEntry) : [],
      }))
    : []
  return {
    equipped,
    sections: sections.length ? sections : [{ id: makeSectionId(), name: DEFAULT_SECTION_NAME, items: [] }],
  }
}

export function allCatalogIds(model) {
  const ids = new Set()
  const walk = list => { for (const it of list || []) if (it.item_id != null) ids.add(it.item_id) }
  walk(model.equipped)
  for (const sec of model.sections || []) walk(sec.items)
  return [...ids]
}

export function cloneModel(model) {
  const cloneEntry = it => ({
    uid: it.uid,
    item_id: it.item_id ?? null,
    count: it.count,
    params: { ...(it.params || {}) },
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

export function entryDisplayData(entry, catalog, typeById = {}) {
  const base = entry.item_id != null ? (catalog[entry.item_id] || null) : null
  const ov = entry.override || {}
  const namedBase = base ? { ...base, name: ov.name ?? base.name } : { name: ov.name ?? '—', data: {} }
  const name = instanceDisplayName(namedBase, entry.params, typeById[base?.typeId])
  const desc = ov.desc ?? base?.data?.desc ?? ''
  const consumable = ov.consumable ?? base?.data?.consumable ?? false
  const measuredLength = Number(entry.params?.length_ft)
  const measuredCost = Number.isFinite(measuredLength) && base?.data?.unit_cost_copper != null
    ? { value: measuredLength * Number(base.data.unit_cost_copper), suggest_id: 1 }
    : null
  const measuredWeight = Number.isFinite(measuredLength) && base?.data?.unit_weight != null
    ? measuredLength * Number(base.data.unit_weight)
    : null
  const cost = ov.cost ?? measuredCost ?? base?.data?.cost ?? ''
  const weight = ov.weight ?? measuredWeight ?? base?.data?.weight ?? null
  const isCustom = entry.item_id == null
  const svg = base?.svg ?? ''
  return { name, desc, consumable, cost, weight, isCustom, svg, base }
}
