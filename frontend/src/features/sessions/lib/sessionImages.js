export const SESSION_IMAGE_CATEGORIES = [
  {
    key: 'settlements',
    label: 'Поселения',
    presets: [
      { key: 'city', label: 'Город' },
      { key: 'village', label: 'Деревня' },
      { key: 'castle', label: 'Замок' },
      { key: 'tavern', label: 'Таверна' },
    ],
  },
  {
    key: 'wilderness',
    label: 'Природа',
    presets: [
      { key: 'forest', label: 'Лес' },
      { key: 'cave', label: 'Пещера' },
      { key: 'mountains', label: 'Горы' },
      { key: 'coast', label: 'Побережье' },
    ],
  },
  {
    key: 'adventure',
    label: 'Приключение',
    presets: [
      { key: 'camp', label: 'Лагерь' },
      { key: 'road', label: 'Дорога' },
      { key: 'ruins', label: 'Руины' },
      { key: 'dungeon', label: 'Подземелье' },
    ],
  },
  {
    key: 'story',
    label: 'Сюжет',
    presets: [
      { key: 'battle', label: 'Бой' },
      { key: 'investigation', label: 'Расследование' },
      { key: 'negotiation', label: 'Переговоры' },
      { key: 'chase', label: 'Погоня' },
      { key: 'puzzle', label: 'Загадка' },
      { key: 'discovery', label: 'Открытие' },
    ],
  },
]

export const SESSION_IMAGE_PRESETS = SESSION_IMAGE_CATEGORIES.flatMap(category => category.presets)

export const NPC_IMAGE_CATEGORIES = [
  {
    key: 'civil', label: 'Горожане', presets: [
      { key: 'npc-scholar', label: 'Учёный' },
      { key: 'npc-artisan', label: 'Ремесленник' },
    ],
  },
  {
    key: 'adventurers', label: 'Искатели приключений', presets: [
      { key: 'npc-ranger', label: 'Следопыт' },
      { key: 'npc-mercenary', label: 'Наёмник' },
    ],
  },
  {
    key: 'intrigue', label: 'Мистика и интриги', presets: [
      { key: 'npc-mystic', label: 'Мистик' },
      { key: 'npc-noble', label: 'Знать' },
    ],
  },
]

export const NPC_IMAGE_PRESETS = NPC_IMAGE_CATEGORIES.flatMap(category => category.presets)

export function sessionImageCategory(key) {
  return SESSION_IMAGE_CATEGORIES.find(category => category.presets.some(preset => preset.key === key))
    ?? SESSION_IMAGE_CATEGORIES[0]
}

export function sessionImagePresetUrl(key) {
  return key ? `/static/chapter-presets/${key}.jpg` : ''
}

export function sessionImageUrl(entity) {
  return entity?.customImageUrl || sessionImagePresetUrl(entity?.imagePresetKey)
}

export function npcImagePresetUrl(key) {
  return key ? `/static/npc-presets/${key}.jpg` : ''
}

export function npcImageUrl(entity) {
  return entity?.customImageUrl || npcImagePresetUrl(entity?.imagePresetKey || 'npc-scholar')
}
