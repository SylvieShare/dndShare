export const REPEAT_SAVE_TIMING = { turn_start: 'В начале хода', turn_end: 'В конце хода', action: 'Действием', custom: 'По условию' }

export function statusRepeatSaveDC(rule, instance) {
  const dc = Number(rule?.dc || instance?.params?.save_dc)
  return Number.isInteger(dc) && dc > 0 && dc <= 100 ? dc : null
}

export function statusRepeatSaveResult(rule, instance, result) {
  const dc = statusRepeatSaveDC(rule, instance)
  if (!dc) return null
  const success = result.total >= dc
  return { dc, ability: Number(rule.ability), success, ended: success, effectUid: instance.uid,
    note: `${success ? 'Успех — эффект снят' : 'Провал — эффект остаётся'} · Сл ${dc}` }
}
