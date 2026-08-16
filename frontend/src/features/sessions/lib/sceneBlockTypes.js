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
  image: {
    label: 'Изображение',
    color: 'var(--success)',
    defaultWidth: 360,
  },
  material: {
    label: 'Материал',
    color: 'var(--accent-hover)',
    defaultWidth: 400,
  },
	location: { label: 'Локация', color: '#4ea58b', defaultWidth: 380 },
	npc: { label: 'NPC', color: '#9b78e8', defaultWidth: 380 },
	quest: { label: 'Задание', color: '#4b8fd5', defaultWidth: 400 },
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
