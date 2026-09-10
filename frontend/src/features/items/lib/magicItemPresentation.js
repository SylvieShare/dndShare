export function magicItemRarity(value) {
  if (value == null || value === '') return 'Редкость не указана'
  return ['Обычный', 'Необычный', 'Редкий', 'Очень редкий', 'Легендарный', 'Артефакт'][Number(value)] || 'Редкость не указана'
}

export function magicAttunementLabel(value) {
  return ({ none: 'Без настройки', required: 'Требует настройки' })[value] || 'Настройку нужно уточнить'
}
