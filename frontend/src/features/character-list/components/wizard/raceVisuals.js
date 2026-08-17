const RACE_IMAGES = new Map([
  ['human', '/static/races/human.jpg'],
  ['человек', '/static/races/human.jpg'],
  ['dwarf', '/static/races/dwarf.jpg'],
  ['дварф', '/static/races/dwarf.jpg'],
  ['дворф', '/static/races/dwarf.jpg'],
  ['elf', '/static/races/elf.jpg'],
  ['эльф', '/static/races/elf.jpg'],
  ['halfling', '/static/races/halfling.jpg'],
  ['полурослик', '/static/races/halfling.jpg'],
  ['gnome', '/static/races/gnome.jpg'],
  ['гном', '/static/races/gnome.jpg'],
  ['halfelf', '/static/races/half-elf.jpg'],
  ['полуэльф', '/static/races/half-elf.jpg'],
  ['halforc', '/static/races/half-orc.jpg'],
  ['полуорк', '/static/races/half-orc.jpg'],
  ['dragonborn', '/static/races/dragonborn.jpg'],
  ['драконорожденный', '/static/races/dragonborn.jpg'],
  ['tiefling', '/static/races/tiefling.jpg'],
  ['тифлинг', '/static/races/tiefling.jpg'],
])

export function normalizeRaceName(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('ru-RU')
    .replaceAll('ё', 'е')
    .replace(/[^a-zа-я0-9]+/g, '')
}

export function raceImageFor(race) {
  const names = [race?.nameEn, race?.data?.nameEn, race?.data?.name_en, race?.name]
  for (const name of names) {
    const image = RACE_IMAGES.get(normalizeRaceName(name))
    if (image) return image
  }
  return race?.iconImageUrl || ''
}
