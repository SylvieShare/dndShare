export const POTION_RARITY = {
  0: { code: 'common', label: 'Обычное', color: 'var(--text-muted)' },
  1: { code: 'uncommon', label: 'Необычное', color: 'var(--success)' },
  2: { code: 'rare', label: 'Редкое', color: 'var(--info)' },
  3: { code: 'very_rare', label: 'Очень редкое', color: 'var(--accent)' },
  4: { code: 'legendary', label: 'Легендарное', color: 'var(--warning)' },
  5: { code: 'artifact', label: 'Артефакт', color: 'var(--danger)' },
}

export function rarityOf(id) {
  return POTION_RARITY[id] ?? POTION_RARITY[0]
}
