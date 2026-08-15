export function narrativeCanvasActions(level) {
  if (level === 'chapters') return [{ id: 'chapter', label: 'Новая глава', icon: 'chapter' }]
  if (level === 'scenes') return [{ id: 'scene', label: 'Новый сценарий', icon: 'scene' }]
  return [
    { id: 'text', label: 'Текстовый блок', icon: 'text' },
    { id: 'list', label: 'Список', icon: 'list' },
    { id: 'combat', label: 'Бой', icon: 'combat' },
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
