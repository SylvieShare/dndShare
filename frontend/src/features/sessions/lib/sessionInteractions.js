export const RPS_CHOICES = [
  { value: 'rock', label: 'Камень' },
  { value: 'scissors', label: 'Ножницы' },
  { value: 'paper', label: 'Бумага' },
]
export const isInteraction = event => ['chat_message', 'rps_challenge'].includes(event?.type)
export const isActiveRpsRound = event => event?.type === 'rps_challenge' && ['pending', 'choosing'].includes(event.data?.status)
export const rpsPlayerReady = (event, uuid) => !!event.data?.[event.data?.senderCharUuid === uuid ? 'senderReady' : 'recipientReady']
export function interactionNeedsResponse(event, uuid) {
  if (event.type === 'chat_message' || event.data?.status === 'pending') return event.data?.recipientCharUuid === uuid
  return isActiveRpsRound(event) && !rpsPlayerReady(event, uuid)
}
export function rpsRoundPrompt(event, uuid) {
  const data = event.data || {}, incoming = data.recipientCharUuid === uuid
  if (data.status === 'pending') return incoming ? 'Вас вызывают в камень / ножницы / бумага. Примите вызов, чтобы выбрать ход.' : 'Вызов отправлен. Ждём, пока соперник примет его.'
  const otherReady = incoming ? data.senderReady : data.recipientReady
  return `${rpsPlayerReady(event, uuid) ? 'Ваш ход выбран.' : 'Выберите ход.'} ${otherReady ? 'Соперник уже выбрал.' : 'Соперник ещё выбирает.'}`
}
export const interactionPeer = (event, uuid) => event.data?.senderCharUuid === uuid ? event.data?.recipientCharUuid : event.data?.senderCharUuid
export const interactionPeerName = (event, uuid) => event.data?.senderCharUuid === uuid ? event.data?.recipientName : event.data?.senderName
export function interactionDetails(event) {
  const data = event.data || {}
  if (event.type === 'chat_message') return `${data.recipientName}: ${data.message}`
  if (event.type !== 'rps_challenge') return ''
  const people = `${data.senderName} → ${data.recipientName}`
  const state = { pending: 'Ожидает принятия', declined: 'Вызов отклонён', cancelled: 'Вызов отозван' }[data.status]
  if (state) return `${people} · ${state}`
  if (data.status === 'choosing') return `${people} · ${data.senderName}: ${data.senderReady ? 'ход выбран' : 'выбирает'} · ${data.recipientName}: ${data.recipientReady ? 'ход выбран' : 'выбирает'}`
  const choice = value => RPS_CHOICES.find(row => row.value === value)?.label || ''
  const result = data.winnerCharUuid ? `Победитель: ${data.winnerCharUuid === data.senderCharUuid ? data.senderName : data.recipientName}` : 'Ничья'
  return `${data.senderName}: ${choice(data.senderChoice)} · ${data.recipientName}: ${choice(data.recipientChoice)} · ${result}`
}
