export function narrativeCanvasActions(level) {
  if (level === 'chapters') return [{ id: 'chapter', label: 'Новая глава', icon: 'chapter' }]
  if (level === 'scenes') return [{ id: 'scene', label: 'Новый сценарий', icon: 'scene' }]
  return [
	{ id: 'text', label: 'Описание', icon: 'text', group: 'content' },
	{ id: 'list', label: 'Диалог', icon: 'dialogue', group: 'content' },
	{ id: 'combat', label: 'Бой', icon: 'combat', group: 'content' },
	{ id: 'reward', label: 'Награда', icon: 'reward', group: 'content' },
	{ id: 'image', label: 'Изображение', icon: 'image', group: 'content' },
	{ id: 'location', label: 'Локация', icon: 'location', group: 'reference', groupLabel: 'Объекты сессии' },
	{ id: 'npc', label: 'NPC', icon: 'npc', group: 'reference' },
	{ id: 'quest', label: 'Задание', icon: 'quest', group: 'reference' },
	{ id: 'material', label: 'Материал', icon: 'material', group: 'reference' },
  ]
}

export function narrativeCanvasEmptyCopy(level) {
  if (level === 'chapters') {
    return { title: 'Здесь появятся главы', description: 'Создайте первую главу и соединяйте главы переходами.' }
  }
  if (level === 'scenes') {
    return { title: 'Здесь появится карта сценариев', description: 'Создавайте сценарии и соединяйте их переходами.' }
  }
  return { title: 'Здесь появится режиссёрская схема', description: 'Добавляйте блоки сценария и соединяйте их переходами.' }
}

export function narrativeCanvasLoadingLabel(level) {
  return level === 'blocks' ? 'Загружаем блоки сценария…' : 'Загружаем сценарии…'
}
