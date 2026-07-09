export const POTION_RARITY = {
  0: { code: 'common', label: 'Обычное', color: '#9aa0ad' },
  1: { code: 'uncommon', label: 'Необычное', color: '#4fae6a' },
  2: { code: 'rare', label: 'Редкое', color: '#4f8fe0' },
  3: { code: 'very_rare', label: 'Очень редкое', color: '#a26cf0' },
  4: { code: 'legendary', label: 'Легендарное', color: '#f0b03c' },
  5: { code: 'artifact', label: 'Артефакт', color: '#e0524e' },
}

export function rarityOf(id) {
  return POTION_RARITY[id] ?? POTION_RARITY[0]
}
