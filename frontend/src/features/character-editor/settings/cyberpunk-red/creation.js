import { RED_ROLES, RED_STATS, RED_SKILLS_BY_KEY, RED_SYSTEM } from './catalogue.js'
import { RED_STAT_TABLES, RED_ROLE_SKILLS, RED_BASIC_SKILLS } from './creationTables.js'
import { validateRedSkillAllocation, validateRedStatAllocation } from './creationValidation.js'
import { redHealthMaximum } from './derived.js'
import {redRoleChoiceErrors,redInitialRoleChoices} from './roleChoices.js'

export const RED_CORE_REVISION = 'core-1.25'
export const RED_METHODS = Object.freeze(['streetrat', 'edgerunner', 'complete'])
export const RED_CORE_PROFILE = Object.freeze({ statBudget: 62, statMin: 2, statMax: 8, skillBudget: 86, skillMax: 6 })
const uid = () => globalThis.crypto.randomUUID()
const checkRole = role => { if (!RED_ROLES.some(r => r.key === role)) throw new RangeError('Unknown role') }

export function redStatsFromRolls(role, method, rolls) {
  checkRole(role)
  if (!['streetrat', 'edgerunner'].includes(method)) throw new RangeError('This method does not use a table')
  if (!Array.isArray(rolls) || rolls.length !== (method === 'streetrat' ? 1 : 10)
    || !rolls.every(d => Number.isInteger(d) && d >= 1 && d <= 10)) throw new RangeError('Invalid stat rolls')
  return Object.fromEntries(RED_STATS.map(({ key }, i) =>
    [key, RED_STAT_TABLES[role][rolls[method === 'streetrat' ? 0 : i] - 1][i]]))
}

export function redSkillSpecialization(key, choices = {}) {
  if (key === 'language') return 'Streetslang'
  if (key === 'local-expert') return choices.homeArea?.trim() || 'Твой дом'
  return RED_SKILLS_BY_KEY[key]?.specializationKind ? (choices.specializations?.[key]?.trim() || '') : null
}

export function redInitialSkills(role, method, choices = {}) {
  checkRole(role)
  if (!RED_METHODS.includes(method)) throw new RangeError('Unknown method')
  const rows = method === 'complete' ? RED_BASIC_SKILLS.map(key => ({ key, rank: 2 })) : RED_ROLE_SKILLS[role]
  const skills = rows.map(({ key, rank }) => ({ uid: uid(), key,
    rank: method === 'edgerunner' ? 2 : rank, specialization: redSkillSpecialization(key, choices) }))
  if (choices.nativeLanguage?.trim()) skills.push({ uid: uid(), key: 'language', specialization: choices.nativeLanguage.trim(), rank: 4 })
  return skills
}

export function validateRedCreation(draft) {
  const errors = []
  const add = (path, code) => errors.push({ path, code })
  if (!draft || !RED_METHODS.includes(draft.method)) return { valid: false, errors: [{ path: 'method', code: 'method-required' }] }
  if (!RED_ROLES.some(r => r.key === draft.role)) return { valid: false, errors: [{ path: 'role', code: 'role-required' }] }
  if (!draft.name?.trim()) add('name', 'name-required')
  for(const code of redRoleChoiceErrors(draft.role,4,draft.roleChoices||redInitialRoleChoices(draft.role)))add('roleChoices',code)
  if (!draft.nativeLanguage?.trim() || draft.nativeLanguage.trim().toLowerCase() === 'streetslang') add('nativeLanguage', 'native-language-required')
  if (draft.method === 'complete') errors.push(...validateRedStatAllocation(draft.stats, RED_CORE_PROFILE).errors)
  else {
    try {
      const expected = redStatsFromRolls(draft.role, draft.method, draft.statRolls)
      if (RED_STATS.some(({ key }) => draft.stats?.[key] !== expected[key])) add('stats', 'stat-table-mismatch')
    } catch { add('stats', 'stat-rolls-required') }
  }
  const minimums = (draft.method === 'edgerunner' ? RED_ROLE_SKILLS[draft.role].map(r => r.key) : RED_BASIC_SKILLS)
    .map(key => ({ key, specialization: redSkillSpecialization(key, draft), rank: 2 }))
  const profile = { ...RED_CORE_PROFILE, minimums,
    grants: draft.nativeLanguage?.trim() ? [{ key: 'language', specialization: draft.nativeLanguage.trim(), rank: 4 }] : [] }
  if (draft.method !== 'complete') profile.allowedSkills = RED_ROLE_SKILLS[draft.role].map(r => r.key)
  const validation = validateRedSkillAllocation(draft.skills || [], profile)
  if (draft.method !== 'streetrat') errors.push(...validation.errors)
  else {
    // Templates are authoritative. Their ranks cannot be substituted by an equal point total.
    const expected = RED_ROLE_SKILLS[draft.role]
    if ((draft.skills || []).length !== expected.length + 1) add('skills', 'template-skill-count')
    for (const item of expected) {
      const specialization = redSkillSpecialization(item.key, draft)
      const found = (draft.skills || []).find(s => s.key === item.key && s.specialization === specialization)
      if (!found || found.rank !== item.rank) add('skills', 'template-skill-mismatch')
    }
    errors.push(...validation.errors.filter(error => error.code !== 'skill-budget'))
  }
  return { valid: errors.length === 0, errors, skills: validation }
}

// Intermediate assembly. Equipment and role choices must be finalized before publication.
export function assembleRedBaseDocument(draft) {
  const result = validateRedCreation(draft)
  if (!result.valid) throw Object.assign(new Error('Invalid Cyberpunk RED character'), { errors: result.errors })
  const maximum = redHealthMaximum(draft.stats.BODY, draft.stats.WILL)
  return { system: RED_SYSTEM, schemaVersion: 1, values: {
    identity: { handle: draft.name.trim(), avatar: null },
    rules: { profile: 'core-2045', revision: RED_CORE_REVISION, contentSourceIds: [...(draft.contentSourceIds || [])] },
    creation: { method: draft.method, complete: false, statRolls: [...(draft.statRolls || [])] },
    stats: { ...draft.stats }, skills: JSON.parse(JSON.stringify(draft.skills)),
    roles: [{ uid: uid(), key: draft.role, rank: 4, choices: JSON.parse(JSON.stringify(draft.roleChoices || redInitialRoleChoices(draft.role))) }],
    health: { current: maximum, deathSavePenalty: 0, injuries: [], conditions: [], addictions: [] },
    humanity: { current: draft.stats.EMP * 10, adjustments: [] }, luck: { current: draft.stats.LUCK },
    inventory: { spaces: [{ uid: uid(), name: 'С собой' }], entries: [] },
    cyberware: { installations: [] }, netrunning: { deckUid: null, loadedPrograms: [], encounter: null },
    economy: { cashEb: draft.method === 'complete' ? 2550 : 500, housingKey: draft.role === 'exec' ? 'corporate-conapt' : 'cargo-container', lifestyleKey: draft.role === 'exec' ? 'good-prepak' : 'kibble', ledger: [] },
    progression: { ipAvailable: 0, ipSpent: 0, reputation: 0, transactions: [] },
    lifepath: { general: JSON.parse(JSON.stringify(draft.lifepath || {})), roleSpecific: {}, contacts: [], notes: '' },
  } }
}
