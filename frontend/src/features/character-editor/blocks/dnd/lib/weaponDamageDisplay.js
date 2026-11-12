import { parseDiceExpression } from '@/shared/lib/dice'

// The roll menu owns the calculation and source labels. This projection only
// joins equal damage types and keeps shared grip contributions once.
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
        if (!group.sources.has(source)) group.sources.set(source, { source, variants: [[], []] })
        group.sources.get(source).variants[variant].push(term)
      }
    }
  }
  return [...groups.values()].map(group => ({
    type: group.type, color: group.color,
    columns: [...group.sources.values()].map(column => {
      let variants = column.variants
      if (!alternatives.length || sameTerms(variants[0], variants[1])) variants = [variants[0]]
      const negative = variants.every(terms => terms.length === 1 && terms[0].sign === '-')
      return {
        source: column.source, operator: negative ? '−' : '+',
        variants: negative ? variants.map(terms => terms.map(term => ({ ...term, sign: '+' }))) : variants,
      }
    }),
  }))
}

function sameTerms(left, right) {
  const signature = terms => JSON.stringify(terms.map(({ kind, sign, n, sides, value }) => ({ kind, sign, n, sides, value })))
  return signature(left) === signature(right)
}
