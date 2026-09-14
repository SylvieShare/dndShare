import { describe, expect, it } from 'vitest'
import { interactionDetails, interactionPeer, interactionPeerName } from './sessionInteractions'
import { sessionEventDetails } from './sessionEventEntity'
import { filterSessionEvents } from './sessionEventFilters'
const data = { senderCharUuid: 'a', recipientCharUuid: 'b', senderName: 'Алиса', recipientName: 'Борис' }
describe('player interactions in the chronicle', () => {
  it('resolves the other participant from either side', () => {
    expect(interactionPeer({ data }, 'a')).toBe('b')
    expect(interactionPeer({ data }, 'b')).toBe('a')
    expect(interactionPeerName({ data }, 'a')).toBe('Борис')
  })
  it('shows message text and recipient and filters interactions separately', () => {
    const event = { type: 'chat_message', data: { ...data, message: 'Привет\nПойдём?' } }
    expect(sessionEventDetails(event)).toBe('Борис: Привет\nПойдём?')
    expect(filterSessionEvents([event, { type: 'dice_roll' }], { categories: ['interaction'] })).toEqual([event])
  })
  it('describes pending and dismissed challenges without revealing choices', () => {
    for (const [status, label] of [['pending', 'Ожидает ответа'], ['declined', 'Вызов отклонён'], ['cancelled', 'Вызов отозван']]) {
      expect(interactionDetails({ type: 'rps_challenge', data: { ...data, status } })).toBe(`Алиса → Борис · ${label}`)
    }
  })
  it('renders both moves and win or draw without treating the outcome as a dice roll', () => {
    const event = { type: 'rps_challenge', data: { ...data, status: 'completed', senderChoice: 'rock', recipientChoice: 'scissors', winnerCharUuid: 'a' } }
    expect(interactionDetails(event)).toBe('Алиса: Камень · Борис: Ножницы · Победитель: Алиса')
    delete event.data.winnerCharUuid
    event.data.recipientChoice = 'rock'
    expect(interactionDetails(event)).toContain('Ничья')
  })
})
