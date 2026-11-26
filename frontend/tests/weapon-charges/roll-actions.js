export const rollDialog = page => page.getByRole('dialog').filter({ has: page.getByLabel('Превью броска') })
export const attackMetric = card => card.getByRole('button', { name: 'Настроить бросок атаки', exact: true })

export function weaponCard(page, title) {
  return page.getByRole('group', { name: title, exact: true })
}

export async function openWeaponRoll(page, title, scope = 'attack') {
  const metric = scope === 'attack' ? 'Настроить бросок атаки' : 'Настроить бросок урона'
  await weaponCard(page, title).getByRole('button', { name: metric, exact: true }).click()
  return rollDialog(page)
}

export async function closeWeaponRoll(page) {
  await rollDialog(page).getByRole('button', { name: 'Закрыть окно броска', exact: true }).click()
}

export function submitRoll(page, scope = 'attack') {
  return rollDialog(page).getByRole('button', { name: scope === 'attack' ? 'Бросить на атаку' : 'Бросить на урон', exact: true })
}
