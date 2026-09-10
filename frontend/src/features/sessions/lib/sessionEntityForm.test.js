import { describe, expect, it } from 'vitest'
import { entityDraft, entityDraftValid, entityFields, entityPayload } from './sessionEntityForm'

describe('session entity form payloads', () => {
  it('keeps NPC references, portrait crop and relation notes during a role edit', () => {
    const npc = { name: 'Мира', raceItemId: 11, bestiaryItemId: 42, imageId: 17, imageFocalX: .2, imageFocalY: .8, color: '#123456', description: 'Заметки', relations: [{ type: 'location', id: 3, note: 'Живёт здесь' }] }
    const draft = entityDraft('npc', npc)
    draft.role = '  Проводник  '
    expect(entityPayload('npc', draft)).toMatchObject({ ...npc, role: 'Проводник' })
    draft.relations[0].note = 'Изменение черновика'
    expect(npc.relations[0].note).toBe('Живёт здесь')
  })

  it('excludes a location and all descendants from parent choices', () => {
    const locations = [{ id: 1, name: 'Город' }, { id: 2, name: 'Дом', parentLocationId: 1 }, { id: 3, name: 'Комната', parentLocationId: 2 }, { id: 4, name: 'Лес' }]
    const options = entityFields('location', entityDraft('location', locations[1]), locations[1], locations).find(field => field.key === 'parentLocationId').options
    expect(options.map(item => item.key)).toEqual(['', 1, 4])
  })

  it('normalizes empty references and keeps all quest text fields independent', () => {
    const draft = entityDraft('quest', { name: 'Задание', goal: 'Цель', condition: 'Условие', reward: 'Награда', consequences: 'Последствия', notes: 'Заметки' })
    draft.reward = ' '
    expect(entityPayload('quest', draft)).toMatchObject({ goal: 'Цель', condition: 'Условие', reward: null, consequences: 'Последствия', notes: 'Заметки' })
    const npc = entityDraft('npc', { name: 'NPC', imageId: 2 })
    expect(entityPayload('npc', npc)).toMatchObject({ raceItemId: null, bestiaryItemId: null })
  })

  it('validates material content and drops fields that do not belong to its type', () => {
    const draft = entityDraft('material', { kind: 'note', name: 'Письмо', content: 'Текст', assetId: 12, caption: 'Подпись', noteStyle: 'letter' })
    expect(entityDraftValid('material', draft)).toBe(true)
    expect(entityPayload('material', draft)).toMatchObject({ assetId: null, caption: null, content: 'Текст', noteStyle: 'letter' })
    draft.kind = 'video'
    draft.asset = { id: 0, url: '' }
    expect(entityDraftValid('material', draft)).toBe(false)
    draft.asset.id = 13
    expect(entityPayload('material', draft)).toMatchObject({ assetId: 13, caption: 'Подпись', content: null, noteStyle: null })
  })
})
