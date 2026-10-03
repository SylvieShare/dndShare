import { magicItemActive } from './characterMagicItems'

// Project the existing catalogue rules; never copy them into an owned instance.
export function weaponCataloguePanels(item, entry, base, values, properties = []) {
  if (!item || !entry || entry.params?.creation?.expired || Number(entry.count ?? 1) <= 0) return []
  const rows = [], ordinary = Number(item.typeId) === 1 ? item : base
  if (ordinary?.data?.notes) {
    const data = ordinary.data, propertyNames = properties.map(row => row.label).filter(Boolean)
    rows.push({ key: 'weapon-base-rules', title: data.mastery ? 'Свойства и искусность' : 'Свойства оружия',
      description: data.notes, item: ordinary, requirements: [
        propertyNames.length && `Свойства: ${propertyNames.join(', ')}.`,
        data.range_min > 0 && `Обычная дистанция: ${data.range_min} футов.`,
        data.range_max > 0 && `Предельная дистанция: ${data.range_max} футов.`,
      ].filter(Boolean) })
  }
  if (Number(item.typeId) === 19 && item.data?.desc && magicItemActive(item, entry, true, values)) {
    const uses = item.data.weapon_uses || []
    rows.push({ key: 'weapon-magic-rules', title: uses.length === 1 ? uses[0].title : 'Магические свойства',
      description: item.data.desc, item, requirements: uses.length ? ['Особое применение запускается из меню атаки этого оружия.'] : [] })
  }
  return rows
}
