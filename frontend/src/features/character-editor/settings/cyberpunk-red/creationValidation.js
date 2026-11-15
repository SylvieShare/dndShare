import { RED_SKILLS_BY_KEY, RED_STATS } from './catalogue.js'

// Budgets, minimum ranks and free grants come from a verified creation profile.
// No sample/mockup budget is silently accepted as an official Core profile.
export function validateRedStatAllocation(stats, profile) {
  if (!profile || !Number.isInteger(profile.statBudget) || profile.statBudget < 0
    || !Number.isInteger(profile.statMin) || !Number.isInteger(profile.statMax)
    || profile.statMin < 0 || profile.statMin > profile.statMax) {
    throw new TypeError('An explicit valid stat profile is required')
  }
  const errors = []
  let spent = 0
  for (const { key } of RED_STATS) {
    const value = stats?.[key]
    if (!Number.isInteger(value) || value < profile.statMin || value > profile.statMax) {
      errors.push({ path: `stats.${key}`, code: 'stat-range', min: profile.statMin, max: profile.statMax })
    } else spent += value
  }
  for (const key of Object.keys(stats || {})) {
    if (!RED_STATS.some(stat => stat.key === key)) errors.push({ path: `stats.${key}`, code: 'unknown-stat' })
  }
  if (spent !== profile.statBudget) errors.push({ path: 'stats', code: 'stat-budget', expected: profile.statBudget, actual: spent })
  return { valid: errors.length === 0, spent, remaining: profile.statBudget - spent, errors }
}

export function validateRedSkillAllocation(entries, profile) {
  if (!profile || !Number.isInteger(profile.skillBudget) || profile.skillBudget < 0
    || !Number.isInteger(profile.skillMax) || profile.skillMax < 0 || profile.skillMax > 10) {
    throw new TypeError('An explicit valid skill profile is required')
  }
  if (!Array.isArray(entries)) throw new TypeError('Skills must be an array')
  const errors = [], identities = new Set(), uids = new Set()
  const granted = profile.grants || []
  let spent = 0
  const identity = entry => `${entry.key}:${String(entry.specialization || '').trim().toLocaleLowerCase()}`
  for (const [index, entry] of entries.entries()) {
    const path = `skills.${index}`
    if (!entry || typeof entry !== 'object') { errors.push({ path, code: 'invalid-skill' }); continue }
    const skill = RED_SKILLS_BY_KEY[entry.key]
    if (!skill) { errors.push({ path, code: 'unknown-skill' }); continue }
    if (!entry.uid || typeof entry.uid !== 'string' || uids.has(entry.uid)) errors.push({ path, code: 'skill-uid' })
    uids.add(entry.uid)
    if (typeof entry.specialization !== 'string' && entry.specialization != null) {
      errors.push({ path, code: 'invalid-specialization' })
    }
    const specialization = String(entry.specialization || '').trim()
    if (skill.specializationKind && !specialization) errors.push({ path, code: 'specialization-required' })
    if (!skill.specializationKind && specialization) errors.push({ path, code: 'specialization-not-supported' })
    const id = identity(entry)
    if (identities.has(id)) errors.push({ path, code: 'duplicate-skill' })
    identities.add(id)
    if (profile.allowedSkills && !profile.allowedSkills.includes(entry.key)) errors.push({ path, code: 'skill-not-allowed' })
    if (!Number.isInteger(entry.rank) || entry.rank < 0 || entry.rank > profile.skillMax) {
      errors.push({ path, code: 'skill-range' }); continue
    }
    const grant = granted.find(g => identity(g) === id)
    const freeRanks = grant?.rank ?? 0
    if (!Number.isInteger(freeRanks) || freeRanks < 0 || freeRanks > profile.skillMax) throw new TypeError('Invalid skill grant')
    if (entry.rank < freeRanks) errors.push({ path, code: 'grant-minimum', minimum: freeRanks })
    spent += Math.max(0, entry.rank - freeRanks) * skill.costMultiplier
  }
  for (const requirement of [...(profile.minimums || []), ...granted]) {
    if (!RED_SKILLS_BY_KEY[requirement.key] || !Number.isInteger(requirement.rank) || requirement.rank < 0) {
      throw new TypeError('Invalid required skill')
    }
    const found = entries.find(entry => entry && identity(entry) === identity(requirement))
    if (!found || !Number.isInteger(found.rank) || found.rank < requirement.rank) {
      errors.push({ path: 'skills', code: 'skill-minimum', key: requirement.key,
        specialization: requirement.specialization || null, minimum: requirement.rank })
    }
  }
  if (spent !== profile.skillBudget) errors.push({ path: 'skills', code: 'skill-budget', expected: profile.skillBudget, actual: spent })
  return { valid: errors.length === 0, spent, remaining: profile.skillBudget - spent, errors }
}
