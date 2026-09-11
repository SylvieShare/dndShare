export function weaponUseRequirements(step, range = step.area?.length_ft) {
  return [
    ...(step.requirements || []),
    step.area && `Линия до ${range} × ${step.area.width_ft} футов`,
    step.save && `Спасбросок: ${['', 'Сила', 'Ловкость', 'Телосложение', 'Интеллект', 'Мудрость', 'Харизма'][step.save.ability]} · Сл ${step.save.dc}${step.save.half ? ' · половина урона при успехе' : ''}`,
  ].filter(Boolean)
}
