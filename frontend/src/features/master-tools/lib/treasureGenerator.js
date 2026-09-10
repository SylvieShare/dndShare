export const TREASURE_TYPES = [1, 2, 10, 12, 13, 14, 19]
export const RARITIES = ['Обычная', 'Необычная', 'Редкая', 'Очень редкая', 'Легендарная', 'Артефакт']
export function randomUnit() {
  const value = new Uint32Array(1)
  crypto.getRandomValues(value)
  return value[0] / 4294967296
}
export function treasureOptionsError(options) {
  for (const [key, min, max, name] of [['level', 1, 20, 'Уровень'], ['count', 0, 20, 'Число предметов'], ['maxRarity', 0, 5, 'Редкость'], ['goldMin', 0, 1000000, 'Монеты от'], ['goldMax', 0, 1000000, 'Монеты до']]) {
    if (options[key] === '' || !Number.isInteger(Number(options[key])) || Number(options[key]) < min || Number(options[key]) > max) return `${name}: укажите целое число от ${min} до ${max}.`
  }
  if (Number(options.goldMin) > Number(options.goldMax)) return 'Минимум монет не может превышать максимум.'
  return ''
}
export function treasureCandidates(items, options) {
  return items.filter(item => {
    const rule = item.data?.treasure
    if (!TREASURE_TYPES.includes(Number(item.typeId)) || !rule || !Number.isFinite(Number(rule.weight)) || !(Number(rule.weight) > 0)) return false
    if (!(Number(rule.min_level) <= Number(options.level) && Number(rule.max_level) >= Number(options.level))) return false
    const magic = [10, 19].includes(Number(item.typeId))
    if (options.pool === 'magic' && !magic || options.pool === 'mundane' && magic) return false
    if (options.typeId && Number(item.typeId) !== Number(options.typeId)) return false
    if (options.publicOnly && item.userId != null) return false
    return Number(item.data?.rarity ?? 0) <= Number(options.maxRarity)
  })
}
export function generateTreasure(items, options, random = randomUnit) {
  const error = treasureOptionsError(options)
  if (error) throw new Error(error)
  const pool = [...new Map(treasureCandidates(items, options).map(item => [String(item.id), item])).values()]
  const selected = []
  for (let n = 0; n < Number(options.count) && pool.length; n++) {
    const total = pool.reduce((sum, item) => sum + Number(item.data.treasure.weight), 0)
    let cursor = random() * total
    let index = pool.findIndex(item => (cursor -= Number(item.data.treasure.weight)) < 0)
    if (index < 0) index = pool.length - 1
    const [item] = pool.splice(index, 1)
    selected.push(item)
  }
  const gold = Number(options.goldMin) + Math.floor(random() * (Number(options.goldMax) - Number(options.goldMin) + 1))
  return { items: selected, gold, missing: Number(options.count) - selected.length }
}
export function treasureText(result) {
  return [`Сокровища · ${result.gold} зм`, ...result.items.map(item => `${item.name} · ${RARITIES[item.data?.rarity ?? 0] || 'Редкость не задана'}`)].join('\n')
}
