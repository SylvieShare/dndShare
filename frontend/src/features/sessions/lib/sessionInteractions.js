export const RPS_CHOICES = [
  { value: 'rock', label: 'Камень' },
  { value: 'scissors', label: 'Ножницы' },
  { value: 'paper', label: 'Бумага' },
]
export const isInteraction = event => ['chat_message', 'rps_challenge'].includes(event?.type)
export const interactionPeer = (event, uuid) => event.data?.senderCharUuid === uuid ? event.data?.recipientCharUuid : event.data?.senderCharUuid
export const interactionPeerName = (event, uuid) => event.data?.senderCharUuid === uuid ? event.data?.recipientName : event.data?.senderName
export function interactionDetails(event) {
  const data = event.data || {}
  if (event.type === 'chat_message') return `${data.recipientName}: ${data.message}`
  if (event.type !== 'rps_challenge') return ''
  const people = `${data.senderName} → ${data.recipientName}`
  const state = { pending: 'Ожидает ответа', declined: 'Вызов отклонён', cancelled: 'Вызов отозван' }[data.status]
  if (state) return `${people} · ${state}`
  const choice = value => RPS_CHOICES.find(row => row.value === value)?.label || ''
  const result = data.winnerCharUuid ? `Победитель: ${data.winnerCharUuid === data.senderCharUuid ? data.senderName : data.recipientName}` : 'Ничья'
  return `${data.senderName}: ${choice(data.senderChoice)} · ${data.recipientName}: ${choice(data.recipientChoice)} · ${result}`
}
