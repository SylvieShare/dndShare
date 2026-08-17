const TOKEN_RE = /([+\-*])((?:\d*)d\d+|\d+)(?:\{([^|}]*)(?:\|([^}]*))?\})?/g

const DASH_RE = new RegExp('[\\u2010-\\u2015\\u2212\\uFE63\\uFF0D]', 'g')
const WS_RE = new RegExp('[\\s\\u00A0\\u1680\\u2000-\\u200B\\u202F\\u205F\\u3000\\uFEFF]+', 'g')
const D_ALIAS_RE = new RegExp('[D\\u043A\\u041A\\u0434\\u0414]', 'g')

function normalizeOutside(s) {
  return s
    .replace(DASH_RE, '-')
    .replace(WS_RE, '')
    .replace(D_ALIAS_RE, 'd')
    .replace(/[×xX]/g, '*')
}

function normalize(expr) {
  const re = /\{[^}]*\}/g
  let out = ''
  let last = 0
  let m
  while ((m = re.exec(expr)) !== null) {
    out += normalizeOutside(expr.slice(last, m.index))
    out += m[0]
    last = m.index + m[0].length
  }
  out += normalizeOutside(expr.slice(last))
  return out
}

export function parseDiceExpression(expr) {
  if (!expr || typeof expr !== 'string') return []
  let s = normalize(expr)
  if (!s) return []
  if (!/^[+-]/.test(s)) s = '+' + s
  const tokens = []
  let m
  TOKEN_RE.lastIndex = 0
  while ((m = TOKEN_RE.exec(s)) !== null) {
    const [, operator, body, label, color] = m
    const sign = operator === '*' ? '×' : operator
    const tag = label ? label.trim() : null
    const col = color ? color.trim() : null
    if (body.includes('d')) {
      const [nStr, mStr] = body.split('d')
      const n = nStr === '' ? 1 : parseInt(nStr, 10)
      const sides = parseInt(mStr, 10)
      if (!n || !sides) continue
      tokens.push({ sign, operator, kind: 'dice', n, sides, label: tag, color: col })
    } else {
      const value = parseInt(body, 10)
      if (Number.isNaN(value)) continue
      tokens.push({ sign, operator, kind: 'flat', value, label: tag, color: col })
    }
  }
  return tokens
}

export function evaluateDiceParts(parts, valueOf = part => part.sum ?? part.value ?? 0) {
  let total = 0
  let product = 0
  for (const [index, part] of parts.entries()) {
    const value = valueOf(part, index)
    const operator = part.operator || (part.sign === '×' ? '*' : part.sign) || '+'
    if (operator === '*') {
      product *= value
      continue
    }
    total += product
    product = operator === '-' ? -value : value
  }
  total += product
  return { total, hasMultiplication: parts.some(part => part.operator === '*' || part.sign === '×') }
}

function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1
}

export function rollDiceExpression(expr) {
  const tokens = parseDiceExpression(expr)
  const parts = tokens.map(t => {
    if (t.kind === 'dice') {
      const rolls = Array.from({ length: t.n }, () => rollDie(t.sides))
      const sum = rolls.reduce((a, b) => a + b, 0)
      return { ...t, rolls, sum }
    }
    return { ...t, sum: t.value }
  })

  const { total, hasMultiplication } = evaluateDiceParts(parts)
  const typeOrder = []
  const typeMap = new Map()
  for (const p of parts) {
    const signed = p.sign === '-' ? -p.sum : p.sum
    const key = p.label || '__base__'
    if (!typeMap.has(key)) {
      typeMap.set(key, { label: p.label, color: p.color, value: 0 })
      typeOrder.push(key)
    }
    const entry = typeMap.get(key)
    entry.value += signed
    if (!entry.color && p.color) entry.color = p.color
  }
  const byType = hasMultiplication
    ? [{ label: null, color: null, value: total }]
    : typeOrder.map(k => typeMap.get(k))

  return { parts, total, byType, expression: expr }
}
