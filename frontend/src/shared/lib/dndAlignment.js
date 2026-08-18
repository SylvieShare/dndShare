export const DND_ALIGNMENTS = Object.freeze([
  'Законно-добрый',
  'Нейтрально-добрый',
  'Хаотично-добрый',
  'Законно-нейтральный',
  'Нейтральный',
  'Хаотично-нейтральный',
  'Законно-злой',
  'Нейтрально-злой',
  'Хаотично-злой',
])

export function normalizeDndAlignment(value) {
  const candidate = String(value || '')
  return DND_ALIGNMENTS.includes(candidate) ? candidate : ''
}
