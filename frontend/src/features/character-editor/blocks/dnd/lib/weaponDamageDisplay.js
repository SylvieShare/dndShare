import { parseDiceExpression } from '@/shared/lib/dice'

// Group equal damage types and preserve source identity across formula updates.
export function weaponDamageDisplay(rows, alternatives = [], fallback = {}) {
  const primary = rows.map(row => ({ ...row, terms: parseDiceExpression(row.expression) }))
  const secondary = alternatives.map(row => ({ ...row, terms: parseDiceExpression(row.expression) }))
  const firstType = [...primary, ...secondary].flatMap(row => row.terms).find(term => term.label)
  const defaultType = firstType?.label || fallback.type || ''
  const defaultColor = firstType?.color || fallback.color || 'var(--warning)'
  const groups = new Map()
  for (const [variant, sources] of [primary, secondary].entries()) {
    for (const row of sources) {
      for (const term of row.terms) {
        const type = term.label || defaultType
        if (!groups.has(type)) groups.set(type, { type, color: term.color || defaultColor, sources: new Map() })
        const group = groups.get(type), source = row.source || 'Оружие'
        const key = row.key ? `key:${row.key}` : `source:${source}`
        if (!group.sources.has(key)) group.sources.set(key, { key, source, roll: !!row.roll, variants: [[], []] })
        group.sources.get(key).variants[variant].push(term)
      }
    }
  }
  return [...groups.values()].map(group => ({
    type: group.type, color: group.color,
    columns: [...group.sources.values()].map(column => {
      let variants = column.variants
      if (!alternatives.length || sameTerms(variants[0], variants[1])) variants = [variants[0]]
      const negative = variants.every(terms => terms.length === 1 && terms[0].sign === '-')
      const formula = splitSharedTerms(negative ? variants.map(terms => terms.map(term => ({ ...term, sign: '+' }))) : variants)
      return {
        key: column.key, source: column.source, roll: column.roll, operator: negative ? '−' : '+',
        ...formula,
      }
    }),
  }))
}

function sameTerms(left, right) {
  return left.length === right.length && left.every((term, index) => termSignature(term) === termSignature(right[index]))
}

function termSignature({ kind, sign, n, sides, value }) {
  return JSON.stringify({ kind, sign, n, sides, value })
}

function splitSharedTerms(variants) {
  // Only independent addends can move outside the grip choice. Keep products intact.
  if (variants.length !== 2 || variants.some(terms => terms.some(term => !['+', '-'].includes(term.sign)))) {
    return { variants, shared: [] }
  }
  const remaining = variants[1].slice(), first = [], shared = []
  for (const term of variants[0]) {
    const match = remaining.findIndex(other => termSignature(term) === termSignature(other))
    if (match < 0) first.push(term)
    else { shared.push(term); remaining.splice(match, 1) }
  }
  if (!first.length && !remaining.length) return { variants: [shared], shared: [] }
  return { variants: [first, remaining], shared }
}
