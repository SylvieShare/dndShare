import { describe, expect, it } from 'vitest'
import { groupSessionImages, npcImageUrl, sessionImageUrl } from './sessionImages'

describe('session image catalogue', () => {
  it('groups API images in their first-seen category order', () => {
    const images = [
      { id: 1, categoryKey: 'places', categoryLabel: 'Места', label: 'Город' },
      { id: 2, categoryKey: 'places', categoryLabel: 'Места', label: 'Лес' },
      { id: 3, categoryKey: 'story', categoryLabel: 'Сюжет', label: 'Бой' },
    ]
    expect(groupSessionImages(images)).toEqual([
      { key: 'places', label: 'Места', images: images.slice(0, 2) },
      { key: 'story', label: 'Сюжет', images: images.slice(2) },
    ])
  })

  it('uses entity URLs for both story and NPC images', () => {
    const entity = { imageId: 42, imageUrl: 'https://storage.example/image.jpg' }
    expect(sessionImageUrl(entity)).toBe(entity.imageUrl)
    expect(npcImageUrl(entity)).toBe(entity.imageUrl)
    expect(sessionImageUrl(null)).toBe('')
  })
})
