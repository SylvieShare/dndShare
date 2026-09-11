/** One cell repeats the rule's dice and its resource cost; zero means no extra damage. */
export function damageUnitsMax(action) {
  const max = Number(action?.resource_units_max)
  return Number.isInteger(max) && max > 1 && max <= 20 ? max : 0
}
export function damageAmountActions(actions, amounts = {}) {
  return actions.map(action => {
    if (!damageUnitsMax(action)) return action
    const amount = Number(amounts[action.key] ?? 0)
    const valid = Number.isInteger(amount) && amount >= 0 && amount <= damageUnitsMax(action)
    return { ...action, selected_units: valid ? amount : 0,
      dice_count: (Number(action.dice_count) || 0) * (valid ? amount : 0),
      resource_cost: (Number(action.resource_cost ?? 1)) * (valid ? amount : 0),
      resource_error: valid ? action.resource_error : 'Недопустимое количество зарядов.' }
  })
}
