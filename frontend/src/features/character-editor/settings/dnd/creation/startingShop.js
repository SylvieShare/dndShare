const COPPER_PER_COIN = { 1: 1, 2: 10, 3: 100, 4: 50, 5: 1000 }

const STARTING_WEALTH = {
  bard: { dice: 5, multiplier: 10 },
  barbarian: { dice: 2, multiplier: 10 },
  fighter: { dice: 5, multiplier: 10 },
  wizard: { dice: 4, multiplier: 10 },
  druid: { dice: 2, multiplier: 10 },
  cleric: { dice: 5, multiplier: 10 },
  warlock: { dice: 4, multiplier: 10 },
  monk: { dice: 5, multiplier: 1 },
  paladin: { dice: 5, multiplier: 10 },
  rogue: { dice: 4, multiplier: 10 },
  ranger: { dice: 5, multiplier: 10 },
  sorcerer: { dice: 3, multiplier: 10 },
}

export function startingWealthRule(classKey) {
  return STARTING_WEALTH[classKey] || null
}

export function startingWealthFormula(classKey) {
  const rule = startingWealthRule(classKey)
  if (!rule) return ''
  return `${rule.dice}к4${rule.multiplier > 1 ? ` × ${rule.multiplier}` : ''} зм`
}

export function rollStartingWealth(classKey, random = Math.random) {
  const rule = startingWealthRule(classKey)
  if (!rule) return null
  const rolls = Array.from({ length: rule.dice }, () => Math.floor(random() * 4) + 1)
  const gold = rolls.reduce((sum, value) => sum + value, 0) * rule.multiplier
  return { classKey, rolls, multiplier: rule.multiplier, gold }
}

export function itemCostCopper(item) {
  const cost = item?.data?.cost
  const value = Number(cost?.value)
  const multiplier = COPPER_PER_COIN[Number(cost?.suggest_id)]
  if (!Number.isFinite(value) || value < 0 || !multiplier) return null
  return Math.round(value * multiplier)
}

export function cartCostCopper(cart = []) {
  return cart.reduce((sum, entry) => {
    const unit = itemCostCopper(entry)
    return sum + (unit == null ? 0 : unit * Math.max(1, Number(entry.count) || 1))
  }, 0)
}

export function formatCopper(value) {
  let copper = Math.max(0, Math.round(Number(value) || 0))
  const gold = Math.floor(copper / 100)
  copper %= 100
  const silver = Math.floor(copper / 10)
  copper %= 10
  return [gold ? `${gold} зм` : '', silver ? `${silver} см` : '', copper ? `${copper} мм` : '']
    .filter(Boolean)
    .join(' ') || '0 зм'
}

export function copperToWallet(value) {
  let copper = Math.max(0, Math.round(Number(value) || 0))
  const gold = Math.floor(copper / 100)
  copper %= 100
  const silver = Math.floor(copper / 10)
  copper %= 10
  return {
    ...(copper ? { 1: copper } : {}),
    ...(silver ? { 2: silver } : {}),
    ...(gold ? { 3: gold } : {}),
  }
}
