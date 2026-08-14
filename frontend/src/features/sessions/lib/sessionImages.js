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
