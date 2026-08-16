import { describe, expect, it } from 'vitest'
import {
  buildLocationForest,
  locationBreadcrumb,
  locationDescendantIds,
  locationKind,
  ruPlural,
  sceneContextLabel,
} from './sessionWorld'

const locations = [
  { id: 3, parentLocationId: 2, name: 'Подвал', kind: 'room', sortOrder: 0 },
  { id: 2, parentLocationId: 1, name: 'Таверна', kind: 'building', sortOrder: 1 },
  { id: 1, parentLocationId: null, name: 'Город', kind: 'settlement', sortOrder: 0 },
  { id: 4, parentLocationId: 1, name: 'Рынок', kind: 'district', sortOrder: 0 },
]

describe('session world helpers', () => {
  it('builds and orders the location hierarchy', () => {
    const forest = buildLocationForest(locations)
    expect(forest.map(node => node.id)).toEqual([1])
    expect(forest[0].children.map(node => node.id)).toEqual([4, 2])
    expect(forest[0].children[1].children.map(node => node.id)).toEqual([3])
  })

  it('returns breadcrumbs and all descendants', () => {
    const byId = new Map(locations.map(location => [location.id, location]))
    expect(locationBreadcrumb(byId.get(3), byId).map(item => item.name)).toEqual(['Город', 'Таверна', 'Подвал'])
    expect([...locationDescendantIds(1, locations)].sort()).toEqual([2, 3, 4])
  })

  it('provides stable labels for kinds and scenario context', () => {
    expect(locationKind('dungeon').shortLabel).toBe('Подземелье')
    expect(locationKind('unknown').key).toBe('other')
    expect(sceneContextLabel({ arcName: 'Путь', chapterNumber: '2', chapterName: 'Шторм' }))
      .toBe('Путь · Глава 2 · Шторм')
    expect([1, 2, 5, 11, 21].map(count => ruPlural(count, 'локация', 'локации', 'локаций')))
      .toEqual(['локация', 'локации', 'локаций', 'локаций', 'локация'])
  })
})
