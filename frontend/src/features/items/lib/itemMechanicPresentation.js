import { CircleDot, Sparkles, Skull, Crosshair, CircleCheck, Swords, ShieldCheck, Dices, WandSparkles } from '@lucide/vue'

export const itemMechanicKinds = {
  resource: { label: 'Ресурс', icon: CircleDot, color: 'var(--accent)' },
  rule: { label: 'Свойство', icon: Sparkles, color: 'var(--info)' },
  curse: { label: 'Проклятие', icon: Skull, color: 'var(--danger)' },
  target: { label: 'Выбранная цель', icon: Crosshair, color: 'var(--accent)' },
  confirmed_use: { label: 'Применение по условию', icon: CircleCheck, color: 'var(--accent)' },
  weapon_use: { label: 'Особое применение', icon: Swords, color: 'var(--accent)' },
  bonus_transfer: { label: 'Перенос бонуса в защиту', icon: ShieldCheck, color: 'var(--info)' },
  last_charge: { label: 'Последний заряд', icon: Dices, color: 'var(--warning)' },
  effect: { label: 'Связанный эффект', icon: WandSparkles, color: 'var(--accent)' },
}
