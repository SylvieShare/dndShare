import { describe, expect, it } from 'vitest'
import { appendVisit, lastWaypoint, mapMarkers, removeEntries, routePoints, routeVisits } from './routePoints'
import { movePoint } from './routes'

const fixture = () => [{ id: 'route', name: 'Путь', color: '#ffffff', points: [
  { id: 'a', x: .1, y: .2, name: 'Начало', note: 'Заметка', chapterId: 11 },
  { id: 'bend', x: .2, y: .3, control: true }, { id: 'b', x: .5, y: .6 },
] }]
describe('shared world route points', () => {
  it('reuses a point without copying its position or metadata and marks its final visit', () => {
    const routes = fixture(), route = routes[0]
    const ref = appendVisit(route, route.points[0])
    expect(ref.refId).toBe('a')
    expect(ref.x).toBeUndefined()
    route.points[0].name = 'Новое имя'; route.points[0].x = .8
    expect(routePoints(route, routes).at(-1)).toMatchObject({ id: ref.id, sourceId: 'a', x: .8, name: 'Новое имя', chapterId: 11 })
    const marker = mapMarkers(routes, 'route', ref.id).find(point => point.sourceId === 'a')
    expect(marker).toMatchObject({ last: true, numbers: [1, 3] })
    expect(routeVisits(route, routes)).toHaveLength(3)
    expect(lastWaypoint(route).id).toBe(ref.id)
    expect(appendVisit(route, route.points[0])).toBeNull()
  })
  it('retains shared point identity and data when its original visit or owning route is removed', () => {
    const routes = fixture()
    routes.push({ id: 'other', points: [{ id: 'return', refId: 'a' }, { id: 'd', x: 1, y: 1 }] })
    removeEntries(routes, route => route.id === 'route')
    expect(routes[0].points).toEqual([])
    expect(routes[1].points[0]).toMatchObject({ id: 'a', name: 'Начало', note: 'Заметка', chapterId: 11, x: .1 })
    expect(routes[1].points[0].refId).toBeUndefined()
  })
  it('promotes a later visit and removes orphaned bends at the edges', () => {
    const routes = fixture(), route = routes[0]
    appendVisit(route, route.points[0])
    removeEntries(routes, (_, point) => point.id === 'a')
    expect(route.points.map(point => point.id)).toEqual(['b', 'a'])
    expect(route.points.at(-1).note).toBe('Заметка')
  })
  it('reorders visits while keeping their bend handles between stops', () => {
    const routes = fixture(), route = routes[0]
    movePoint(route, 'b', -1)
    expect(route.points.map(point => point.id)).toEqual(['b', 'bend', 'a'])
    expect(routeVisits(route, routes).map(point => point.id)).toEqual(['b', 'a'])
  })
  it('keeps marker numbering and endpoint flags in the active route context', () => {
    const routes = fixture()
    routes.push({ id: 'other', name: 'Обход', color: '#000000', points: [{ id: 'shared', refId: 'a' }] })
    expect(mapMarkers(routes, 'other', '').find(point => point.sourceId === 'a')).toMatchObject({ routeId: 'other', numbers: [1], last: true })
    expect(mapMarkers(routes, 'other', '').find(point => point.sourceId === 'b').last).toBe(false)
  })

})
