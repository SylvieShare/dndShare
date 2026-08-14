export const SCENE_BLOCK_TYPES = {
  text: {
    label: 'Текст',
    color: 'var(--info)',
    defaultWidth: 300,
  },
  list: {
    label: 'Список',
    color: 'var(--accent)',
    defaultWidth: 300,
  },
  combat: {
    label: 'Бой',
    color: 'var(--danger)',
    defaultWidth: 360,
  },
}

export function sceneBlockType(type) {
  return SCENE_BLOCK_TYPES[type] || SCENE_BLOCK_TYPES.text
}

export function sceneBlockColor(type) {
  return sceneBlockType(type).color
}

export function sceneBlockDefaultWidth(type) {
  return sceneBlockType(type).defaultWidth
}
