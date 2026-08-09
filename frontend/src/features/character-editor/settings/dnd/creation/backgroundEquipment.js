/**
 * Starting possessions in handbook background items are stored as one rich-text
 * sentence. Split that sentence into custom inventory rows and coin amounts so
 * the create wizard can apply both mechanically.
 */

export const COIN_IDS = { 'мм': 1, 'см': 2, 'зм': 3, 'эм': 4, 'пм': 5 }
export const COIN_ORDER = [1, 2, 3, 4, 5]

const COIN_LABELS = Object.fromEntries(Object.entries(COIN_IDS).map(([label, id]) => [id, label]))

function stripHtml(value) {
  return String(value || '')
    .replace(/<br\s*\/?\s*>/gi, ', ')
    .replace(/<\/p\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function equipmentData(background) {
  return background?.item?.data || background?.data || {}
}

export function backgroundStartingEquipment(background) {
  const text = stripHtml(equipmentData(background).equipment)
  const items = []
  const coins = {}

  for (const raw of text.split(/\s*,\s*/)) {
    const fragment = raw.trim().replace(/[.;]+$/, '').trim()
    if (!fragment) continue

    const money = fragment.match(/^(?:кошел(?:ь|ёк|ек)\s+с\s+)?(\d+)\s*(мм|см|эм|зм|пм)\.?$/i)
    if (money) {
      const coinId = COIN_IDS[money[2].toLocaleLowerCase('ru')]
      coins[coinId] = (Number(coins[coinId]) || 0) + Number(money[1])
      continue
    }

    items.push({ id: null, name: fragment, count: 1 })
  }

  return { text, items, coins, gold: Number(coins[COIN_IDS['зм']]) || 0 }
}

export function formatStartingCoins(coins = {}) {
  return COIN_ORDER
    .filter((id) => Number(coins[id]) > 0)
    .map((id) => `${Number(coins[id])} ${COIN_LABELS[id]}`)
    .join(', ')
}

export function addStartingCoins(value, additions = {}) {
  const amounts = {}
  const order = []

  if (value?.amounts && typeof value.amounts === 'object') {
    Object.assign(amounts, value.amounts)
    if (Array.isArray(value.order)) order.push(...value.order)
  } else if (Array.isArray(value)) {
    for (const coin of value) {
      const id = coin?.item_id ?? coin?.itemId ?? coin?.id
      if (id != null) {
        amounts[id] = Number(coin.amount) || 0
        order.push(id)
      }
    }
  } else if (value && typeof value === 'object') {
    Object.assign(amounts, value)
  }

  for (const id of COIN_ORDER) {
    if (!order.some((saved) => String(saved) === String(id))) order.push(id)
  }
  for (const [id, amount] of Object.entries(additions)) {
    amounts[id] = (Number(amounts[id]) || 0) + (Number(amount) || 0)
  }

  return { amounts, order }
}
