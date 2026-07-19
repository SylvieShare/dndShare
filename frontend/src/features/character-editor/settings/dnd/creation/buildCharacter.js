/**
 * D&D create-flow assembler — the pure "brain" of the creation wizard.
 *
 * Takes the wizard's selections (race/class items, chosen ability scores, skill
 * and spell picks) and produces the `{ name, data: { values } }` payload posted
 * to `/chars`. Orchestrates `newCharacter` + `grants` + `progression`.
 *
 * Pure and side-effect free: the caller injects `suggestValue` and the already
 * fetched ability items, so this is unit-testable without Pinia or the network.
 */

import { abilityModifier } from '@/shared/lib/dnd'
import { STAT_KEYS } from '@/shared/lib/dndStats'
import { computeSlots } from '../../../blocks/dnd/lib/levelUp.js'
import { defaultSlots } from '../../../blocks/dnd/lib/spellEntry.js'
import { blankValues } from '../newCharacter.js'
import { applyGrants, extractGrants } from './grants.js'
import { featureIdsForBinding } from './progression.js'

const STATS = STAT_KEYS

// skill suggest id (type 15) -> owning ability score. Mirrors the per-stat
// `content.suggest_ids` in settings/dnd/blocks.json.
const SKILL_BY_STAT = (() => {
  const byStat = { STR: [1], DEX: [2, 3, 4], CON: [], INT: [5, 6, 7, 8, 9], WIS: [10, 11, 12, 13, 14], CHA: [15, 16, 17, 18] }
  const map = {}
  for (const [stat, ids] of Object.entries(byStat)) ids.forEach((id) => { map[String(id)] = stat })
  return map
})()

function mod(score) {
  return abilityModifier(score)
}

function ref(sel) {
  if (!sel) return null
  return { id: sel.id, name: sel.name ?? sel.item?.name ?? '' }
}

// Grant a skill proficiency (suggest 15) into its owning stat block.
function addSkillProf(values, skillId) {
  const stat = SKILL_BY_STAT[String(skillId)]
  if (!stat) return
  const block = { ...(values[stat] || {}) }
  block.skills = { ...(block.skills || {}), [String(skillId)]: { up: 1, override_title: '', bonuses: [] } }
  values[stat] = block
}

// Append language proficiencies (value strings) to the character's Языки bucket.
function addLanguages(values, labels) {
  if (!labels.length) return
  const profs = { ...(values.proficiencies || {}) }
  profs['Языки'] = [...(profs['Языки'] || [])]
  labels.forEach((l) => { if (l && !profs['Языки'].includes(l)) profs['Языки'].push(l) })
  values.proficiencies = profs
}

/**
 * @param {object} input
 * @param {string} input.name
 * @param {{id,name,item}} input.race
 * @param {{id,name,item}|null} input.subrace
 * @param {{id,name,item}} input.charClass
 * @param {{id,name,item}|null} input.subclass
 * @param {object} input.scores  base ability scores `{ STR, DEX, ... }`
 * @param {Array<number>} input.skillIds   chosen skill proficiencies (suggest 15)
 * @param {Array<number>} input.spellIds   chosen spell item ids
 * @param {Array<object>} input.raceAbilityItems  fetched type-3 abilities
 * @param {Array<object>} input.classAbilityItems fetched type-4 abilities
 * @param {(typeId:number,id:number)=>string} input.suggestValue
 * @returns {{ name: string, data: { values: object } }}
 */
export function buildCharacterData(input) {
  const {
    name = '', race, subrace = null, charClass, subclass = null, raceVariant = null,
    background = null,
    scores = {}, asiChoice = [], skillIds = [], spellIds = [], grantedSpellIds = [], choices = [],
    raceSkillIds = [], raceLangIds = [], featIds = [], bgLangIds = [],
    equipment = [], persona = null,
    raceAbilityItems = [], classAbilityItems = [], suggestValue,
  } = input || {}

  const grants = extractGrants({
    race: race?.item, subrace: subrace?.item,
    charClass: charClass?.item, subclass: subclass?.item,
    raceVariant, background: background?.item,
  })

  const raceBinding = { raceId: race?.id, subraceId: subrace?.id }
  const classBinding = { classId: charClass?.id, subclassId: subclass?.id }
  const raceAbilityIds = featureIdsForBinding(raceAbilityItems, raceBinding, 1)
  const classAbilityIds = featureIdsForBinding(classAbilityItems, classBinding, 1)

  let { values } = applyGrants(blankValues(), grants, { suggestValue, raceAbilityIds, classAbilityIds })

  // Ability scores: chosen base + racial ASI (fixed + floating choice) as a named bonus.
  const floatBonus = grants.asiChoice?.bonus || 0
  const finalScore = {}
  for (const stat of STATS) {
    const base = Number(scores[stat] ?? 10)
    const fixed = (grants.asi || []).filter((a) => a.stat === stat).reduce((s, a) => s + a.bonus, 0)
    const floating = asiChoice.includes(stat) ? floatBonus : 0
    const racial = fixed + floating
    const bonuses = racial ? [{ title: ref(race)?.name || 'Раса', value: racial }] : []
    values[stat] = { ...(values[stat] || {}), value: { base, bonuses } }
    finalScore[stat] = base + racial
  }

  // HP at level 1 = hit-die face (set by applyGrants) + CON modifier.
  if (values.hp && Number(values.hp.max)) {
    const hp = values.hp.max + mod(finalScore.CON)
    values.hp = { ...values.hp, max: hp, current: hp }
  }

  // Skill proficiencies (class skill_choice + race skill choice + background fixed).
  for (const raw of skillIds) addSkillProf(values, raw)
  for (const raw of raceSkillIds) addSkillProf(values, raw)
  for (const raw of (grants.backgroundSkills || [])) addSkillProf(values, raw)

  // Race-chosen + background-chosen extra languages (suggest 6) into the Языки bucket.
  addLanguages(values, raceLangIds.map((id) => suggestValue?.(6, id)).filter(Boolean))
  addLanguages(values, bgLangIds.map((id) => suggestValue?.(6, id)).filter(Boolean))

  // Chosen feats (handbook type 7) → the sheet's Черты block (`abilities_feats`).
  if (featIds.length) values.abilities_feats = featIds.map((id) => ({ id }))

  // Feature choices (granted abilities' `choice`): skill/language picks are
  // applied mechanically; every choice is recorded under `feature_choices`.
  for (const ch of choices) {
    const sel = ch?.selected || []
    if (!sel.length) continue
    if (Number(ch.from_suggest_id) === 15) sel.forEach((id) => addSkillProf(values, id))
    else if (Number(ch.from_suggest_id) === 6) addLanguages(values, sel.map((id) => suggestValue?.(6, id)).filter(Boolean))
    if (ch.abilityId != null) {
      values.feature_choices = { ...(values.feature_choices || {}), [ch.abilityId]: sel.slice() }
    }
  }

  // Spells (casters): known/prepared list + level-1 slots. Slot totals come from
  // the shared caster table (full 2 / half 0 / artificer 2 / warlock pact 1).
  // Granted subclass spells (cleric domains) are appended as prepared.
  const grantedExtra = grantedSpellIds.filter((id) => !spellIds.includes(id))
  if (grants.spellcasting || spellIds.length || grantedExtra.length) {
    const slots = defaultSlots()
    const slotInfo = charClass ? computeSlots(
      [{ id: charClass.id, level: 1, subclass: subclass ? { id: subclass.id } : null }],
      { [charClass.id]: charClass.item, ...(subclass?.item ? { [subclass.id]: subclass.item } : {}) },
    ) : null
    if (slotInfo?.isCaster) slotInfo.totals.forEach((n, i) => { if (n) slots[i] = { ...slots[i], total: n } })
    else if (grants.spellcasting) slots[0] = { ...slots[0], total: 2 }
    values.spells = {
      stat_path: grants.spellcasting?.abilityId ?? '',
      spells: [...spellIds, ...grantedExtra].map((id) => ({ id, prepared: true })),
      slots,
      ...(slotInfo?.pactMerged ? { slots_rest: 'short_rest' } : {}),
    }
  }

  // Background: identity ref + name shown in the sheet's "Происхождение" field +
  // its feature appended to notes (create-time notes are empty).
  if (background) {
    values.background = ref(background)
    values.person_origin = ref(background)?.name || ''
    const bd = background.item?.data || {}
    const featTitle = bd.feature ? String(bd.feature).trim() : ''
    const featDesc = bd.feature_desc ? String(bd.feature_desc).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : ''
    if (featTitle || featDesc) {
      values.notes = `Черта предыстории — ${featTitle}${featTitle && featDesc ? ': ' : ''}${featDesc}`
    }
  }

  // Starting equipment → the inventory block (`values.items`) as one bag section.
  if (equipment.length) {
    values.items = {
      equipped: [],
      sections: [{
        id: 'bag',
        name: 'Снаряжение',
        items: equipment.map((e, i) => ({ uid: `eq_${i}`, id: e.id, count: Math.max(1, Number(e.count) || 1), override: null })),
      }],
    }
  }

  // Personality / description → the person_* sheet blocks (all optional, plain strings).
  if (persona) {
    const P = { alignment: 'person_alignment', traits: 'person_traits', ideals: 'person_ideals', bonds: 'person_bonds', flaws: 'person_flaws', appearance: 'person_appearance', age: 'person_age', height: 'person_height', weight: 'person_weight', eyes: 'person_eyes', hair: 'person_hair', skin: 'person_skin' }
    for (const [k, blockId] of Object.entries(P)) {
      const v = persona[k]
      if (v != null && String(v).trim() !== '') values[blockId] = v
    }
  }

  // Identity: store race/class as { id, name } references (item-id binding).
  values.name = name
  values.race = ref(race)
  values.class = ref(charClass)
  if (subrace) values.subrace = ref(subrace)
  if (subclass) values.subclass = ref(subclass)
  if (raceVariant) values.race_variant = raceVariant
  // Multiclass-ready class list (level-up / identity window edit it later).
  if (charClass) values.classes = [{ ...ref(charClass), level: 1, subclass: ref(subclass) }]

  return { name: name || 'Без имени', data: { values } }
}

export { SKILL_BY_STAT }
