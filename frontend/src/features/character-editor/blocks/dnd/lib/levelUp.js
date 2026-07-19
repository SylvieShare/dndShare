/**
 * D&D 5e level-up + multiclass math. Pure functions — no Vue, no stores.
 *
 * Character classes live in `values.classes`: `[{ id, name, level, subclass }]`
 * (`subclass` — `{ id, name }` or null). Legacy single-class sheets carry only
 * `values.class`/`values.subclass` + `values.lvl.level`; `classEntriesOf`
 * migrates that shape on read. `values.class`/`values.subclass` stay mirrored
 * to the first entry for old consumers (identity subline, spells stat).
 *
 * Caster math follows the PHB 2014 multiclass rules. Caster kind is detected
 * from the handbook item's `nameEn` (stable, unlike Russian display names).
 */

export const LEVEL_CAP = 20

// ─── class entries ──────────────────────────────────────────────────────────

export function classEntriesOf(values) {
  const list = Array.isArray(values?.classes) ? values.classes.filter((c) => c && c.id != null) : []
  if (list.length) {
    const entries = list.map((c) => ({
      id: c.id,
      name: c.name || '',
      level: Math.max(1, parseInt(c.level) || 1),
      subclass: c.subclass && c.subclass.id != null ? { id: c.subclass.id, name: c.subclass.name || '' } : null,
    }))
    // Одиночный класс: уровнем правит блок уровня листа (level up / ручная правка).
    const sheetLvl = parseInt(values?.lvl?.level)
    if (entries.length === 1 && Number.isFinite(sheetLvl) && sheetLvl > 0) {
      entries[0].level = Math.min(LEVEL_CAP, sheetLvl)
    }
    return entries
  }
  const cls = values?.class
  if (cls && typeof cls === 'object' && cls.id != null) {
    const sub = values?.subclass
    return [{
      id: cls.id,
      name: cls.name || '',
      level: Math.max(1, parseInt(values?.lvl?.level) || 1),
      subclass: sub && typeof sub === 'object' && sub.id != null ? { id: sub.id, name: sub.name || '' } : null,
    }]
  }
  return []
}

export function totalLevel(entries) {
  return entries.reduce((sum, e) => sum + (Math.max(1, parseInt(e.level) || 1)), 0)
}

/** "Волшебник 6 (Некромантия) · Плут 2" — multiclass subline. */
export function classesLabel(entries) {
  return entries
    .map((e) => `${e.name} ${e.level}${e.subclass ? ` (${e.subclass.name})` : ''}`)
    .join(' · ')
}

// ─── ASI levels ─────────────────────────────────────────────────────────────

const DEFAULT_ASI_LEVELS = [4, 8, 12, 16, 19]

export function parseAsiLevels(raw) {
  const list = String(raw ?? '')
    .split(/[,;\s]+/)
    .map((s) => parseInt(s))
    .filter((n) => Number.isFinite(n) && n > 0)
  return list.length ? list : DEFAULT_ASI_LEVELS
}

// ─── hit points ─────────────────────────────────────────────────────────────

export function dieFaceOf(label) {
  const m = String(label || '').match(/(\d+)/)
  return m ? Number(m[1]) : null
}

/** Average hit-die roll used on level up: face/2 + 1 (PHB "fixed" option). */
export function avgHitDie(face) {
  return Math.floor((Number(face) || 8) / 2) + 1
}

// ─── spell slots (PHB multiclass spellcaster table) ─────────────────────────

export const FULL_CASTER_SLOTS = [
  [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2],
  [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1],
]

const FULL_CASTERS = ['bard', 'cleric', 'druid', 'sorcerer', 'wizard']
const HALF_CASTERS = ['paladin', 'ranger']
const THIRD_SUBCLASSES = ['eldritch knight', 'arcane trickster']

/** 'full' | 'half' | 'halfup' | 'third' | 'pact' | null from handbook items. */
export function casterKindOf(classItem, subclassItem) {
  const n = String(classItem?.nameEn || '').trim().toLowerCase()
  if (FULL_CASTERS.includes(n)) return 'full'
  if (HALF_CASTERS.includes(n)) return 'half'
  if (n === 'artificer') return 'halfup'
  if (n === 'warlock') return 'pact'
  const s = String(subclassItem?.nameEn || '').trim().toLowerCase()
  if (THIRD_SUBCLASSES.includes(s)) return 'third'
  return null
}

export function pactSlots(warlockLevel) {
  const l = Math.max(0, Math.min(LEVEL_CAP, warlockLevel))
  if (!l) return null
  return {
    count: l >= 17 ? 4 : l >= 11 ? 3 : l >= 2 ? 2 : 1,
    slotLevel: Math.min(5, Math.ceil(l / 2)),
  }
}

/**
 * Slot totals (index 0 = 1st circle) for a set of class entries.
 * `itemsById` — handbook items for every class/subclass id in the entries.
 *
 * Single-class characters use their own class table (half/third casters round
 * up); a multiclass combination sums caster levels per the PHB rules (round
 * down) and reads the shared table. Warlock pact magic is a separate pool: it
 * lands in `pact` and is merged into `totals` only when there is no other
 * caster to share the slot row with.
 */
export function computeSlots(entries, itemsById) {
  const kinds = entries.map((e) => ({
    e,
    kind: casterKindOf(itemsById[e.id], e.subclass ? itemsById[e.subclass.id] : null),
  })).filter((c) => c.kind)

  const casters = kinds.filter((c) => c.kind !== 'pact')
  let casterLevel = 0
  if (casters.length === 1 && kinds.length === 1) {
    const { e, kind } = casters[0]
    casterLevel = kind === 'full' ? e.level
      : kind === 'halfup' ? Math.ceil(e.level / 2)
        : kind === 'half' ? (e.level < 2 ? 0 : Math.ceil(e.level / 2))
          : (e.level < 3 ? 0 : Math.ceil(e.level / 3))
  } else {
    for (const { e, kind } of casters) {
      casterLevel += kind === 'full' ? e.level
        : kind === 'halfup' ? Math.ceil(e.level / 2)
          : kind === 'half' ? Math.floor(e.level / 2)
            : Math.floor(e.level / 3)
    }
  }

  const totals = Array(9).fill(0)
  if (casterLevel > 0) {
    FULL_CASTER_SLOTS[Math.min(LEVEL_CAP, casterLevel) - 1].forEach((n, i) => { totals[i] = n })
  }

  const warlockLevel = kinds.filter((c) => c.kind === 'pact').reduce((s, c) => s + c.e.level, 0)
  const pact = pactSlots(warlockLevel)
  const pactMerged = !!pact && casterLevel === 0
  if (pactMerged) totals[pact.slotLevel - 1] += pact.count

  return { totals, casterLevel, pact, pactMerged, isCaster: casterLevel > 0 || !!pact }
}

// ─── multiclassing rules (PHB, keyed by class nameEn) ───────────────────────

/** Each inner array is "one of these ≥ 13"; all groups must pass. */
export const MULTICLASS_REQS = {
  barbarian: [['STR']],
  bard: [['CHA']],
  cleric: [['WIS']],
  druid: [['WIS']],
  fighter: [['STR', 'DEX']],
  monk: [['DEX'], ['WIS']],
  paladin: [['STR'], ['CHA']],
  ranger: [['DEX'], ['WIS']],
  rogue: [['DEX']],
  sorcerer: [['CHA']],
  warlock: [['CHA']],
  wizard: [['INT']],
  artificer: [['INT']],
}

/** Proficiencies gained when taking the class as a SECOND class (PHB table). */
export const MULTICLASS_PROFS = {
  barbarian: 'Щиты, простое и воинское оружие',
  bard: 'Лёгкие доспехи, один навык на выбор, один музыкальный инструмент',
  cleric: 'Лёгкие и средние доспехи, щиты',
  druid: 'Лёгкие и средние доспехи, щиты (без металла)',
  fighter: 'Лёгкие и средние доспехи, щиты, простое и воинское оружие',
  monk: 'Простое оружие, короткие мечи',
  paladin: 'Лёгкие и средние доспехи, щиты, простое и воинское оружие',
  ranger: 'Лёгкие и средние доспехи, щиты, простое и воинское оружие, один навык из списка класса',
  rogue: 'Лёгкие доспехи, один навык из списка класса, воровские инструменты',
  sorcerer: '',
  warlock: 'Лёгкие доспехи, простое оружие',
  wizard: '',
  artificer: 'Лёгкие и средние доспехи, щиты, воровские инструменты, инструменты ремонтника',
}

/**
 * Check the PHB multiclass prerequisite for a class against final scores
 * `{ STR: 15, ... }`. Returns `{ ok, need }` where `need` is a human list of
 * unmet groups (e.g. [['STR','CHA']] → "СИЛ 13 и ХАР 13").
 */
export function multiclassCheck(classItem, scores) {
  const key = String(classItem?.nameEn || '').trim().toLowerCase()
  const groups = MULTICLASS_REQS[key]
  if (!groups) return { ok: true, failed: [] }
  const failed = groups.filter((alts) => !alts.some((s) => (Number(scores?.[s]) || 10) >= 13))
  return { ok: failed.length === 0, failed }
}
