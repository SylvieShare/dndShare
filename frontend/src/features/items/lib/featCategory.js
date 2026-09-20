export const FEAT_CATEGORIES = Object.freeze({
  origin: 'Черта происхождения',
  general: 'Универсальная черта',
  epic_boon: 'Эпический дар',
  fighting_style: 'Боевой стиль',
})

export function featCategoryLabel(item) {
  return FEAT_CATEGORIES[item?.data?.category] || ''
}
