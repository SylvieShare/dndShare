export function sessionImageUrl(entity) {
  return entity?.imageUrl || ''
}

export function npcImageUrl(entity) {
  return sessionImageUrl(entity)
}

export function groupSessionImages(images = []) {
  const categories = []
  const byKey = new Map()
  for (const image of images) {
    let category = byKey.get(image.categoryKey)
    if (!category) {
      category = { key: image.categoryKey, label: image.categoryLabel, images: [] }
      byKey.set(image.categoryKey, category)
      categories.push(category)
    }
    category.images.push(image)
  }
  return categories
}
