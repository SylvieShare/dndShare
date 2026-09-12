import { readRichNode, sanitizeRichHtml } from '@sylvieshare/share-ui'
import { parseDiceExpression } from './dice'

/** Derive menu rolls from the same atomic nodes rendered in rich descriptions. */
export function richDescriptionRolls(html) {
  if (!html || typeof DOMParser === 'undefined') return []
  const document = new DOMParser().parseFromString(sanitizeRichHtml(html), 'text/html')
  const seen = new Set()
  return [...document.querySelectorAll('[data-rich-node]')].flatMap(element => {
    const node = readRichNode(element)
    if (node?.kind !== 'dice') return []
    const formula = String(node.payload.formula || '').trim()
    const parts = parseDiceExpression(formula)
    if (!parts.some(part => part.kind === 'dice')) return []
    const label = String(node.payload.label || node.label || formula).trim()
    const key = JSON.stringify([parts, label])
    if (seen.has(key)) return []
    seen.add(key)
    return [{ key, formula, label }]
  })
}
