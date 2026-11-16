/** Preserve each die's damage type and add its flat bonus exactly once. */
export function spellMetricRows(parts, typed = true) {
  const expression = (parts || []).flatMap(part => {
    const type = typed && part.type ? `{${part.type}${part.typeColor ? `|${part.typeColor}` : ''}}` : ''
    return [part.diceLabel ? `${part.count || 1}${part.diceLabel}${type}` : '', part.bonus ? `${part.bonus}${type}` : ''].filter(Boolean)
  }).join('+').replace(/\+-/g, '-')
  return expression ? [{ source: 'Заклинание', expression }] : []
}
