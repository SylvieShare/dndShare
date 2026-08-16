export const SCENE_BLOCK_TYPES = {
  text: {
    label: 'Описание',
    color: 'var(--info)',
    defaultWidth: 300,
  },
  list: {
    label: 'Диалог',
    color: 'var(--accent)',
    defaultWidth: 300,
  },
  combat: {
    label: 'Бой',
    color: 'var(--danger)',
    defaultWidth: 360,
  },
  reward: {
    label: 'Награда',
    color: 'var(--warning)',
    defaultWidth: 320,
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
