export const parent = { id: 4069, typeId: 4, name: 'Таинственные воззвания', data: {
  class_ids: [{ id: 4018 }], level: 2, ability_selection: { counts: [{ level: 2, count: 2 }, { level: 5, count: 3 }], replace_count: 1 },
} }
export const warlock = { id: 4018, typeId: 9, name: 'Колдун', data: { hit_die: 'd8' } }
export const options = ['Доспех теней', 'Дьявольский взгляд', 'Звериная речь', 'Мистическое копьё'].map((name, i) => ({
  id: 9000 + i, typeId: 4, name, data: { desc: `<p>${name}: описание.</p>`, class_ids: [{ id: 4018 }], level: 2, selection_parent_id: parent.id,
    ...(i === 3 ? { selection_requirements: { spells: [{ id: 500, name: 'Мистический заряд' }] } } : {}),
  },
}))
export const types = [{ id: 4, name: 'Классовые способности', fields: [
  { key: 'desc', type: 'description', name: 'Описание' },
  { key: 'selection_parent_id', type: 'item', item_type: 4, name: 'Набор способностей' },
] }, { id: 9, name: 'Классы', fields: [] }]
export const items = [parent, warlock, ...options]
