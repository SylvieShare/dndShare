import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createPinia } from 'pinia'
import { expect, it, vi } from 'vitest'
import { useSuggestStore } from '@/stores/suggest'
import MagicEquipmentAdditions from './MagicEquipmentAdditions.vue'
import MagicItemDetailSummary from './MagicItemDetailSummary.vue'
import WeaponRollControls from '@/features/character-editor/blocks/dnd/components/WeaponRollControls.vue'
import { weaponDamageMenuOptions } from '@/shared/lib/weaponDamageOptions'
import DamageRollOptions from '@/features/character-editor/blocks/dnd/components/DamageRollOptions.vue'

const actions = [
  { key: 'throw', label: 'Метнуть', condition: 'При попадании брошенным молотом.', dice: 'd8', dice_count: 1, attack_mode: 'thrown' },
  { key: 'giant', label: 'Цель — великан', condition: 'При броске по великану: ещё 1к8, всего +2к8.', requires_damage_key: 'throw', dice: 'd8', dice_count: 1 },
]
const item = { data: { type: 'оружие', rarity: 3, weapon: { magic_bonus: 3 }, weapon_damage: actions, attunement: 'required' } }
async function render(component, props) {
  const app = createSSRApp({ render: () => h(component, props) })
  const pinia = createPinia()
  useSuggestStore(pinia).set(17, [])
  app.use(pinia)
  return renderToString(app)
}
it('presents conditions and additive dice beside magic enhancements without exposing link keys', async () => {
  const html = await render(MagicEquipmentAdditions, { item, kind: 'weapon' })
  for (const text of ['Что добавляется к оружию', '+3', '+1к8', 'Метнуть', 'Цель — великан', actions[1].condition, 'Вместе с «Метнуть»']) expect(html).toContain(text)
  expect(html).not.toContain('requires_damage_key')
})
it('makes the giant option visibly conditional and initially disabled in the weapon menu', async () => {
  const html = await render(WeaponRollControls, { scope: 'damage', options: weaponDamageMenuOptions(actions, []), versatile: true })
  expect(html).toContain('damage-dependent-option')
  expect(html).toContain(actions[1].condition)
  expect(html).toMatch(/<button(?=[^>]*disabled)(?=[^>]*aria-label="Цель — великан")[^>]*>/)
  expect(html).toContain('Бросить на урон')
  expect(html).toContain('aria-label="Добавит +1к8"')
  expect(html).toContain('--dd-size:26px')
  expect(html).toContain('<svg')
})
it('provides background icons for every populated magic-item cover card and rail', async () => {
  const html = await render(MagicItemDetailSummary, { item })
  expect(html.match(/class="[^"]*cover-stat-card-mark/g)).toHaveLength(3)
  expect(html.match(/class="[^"]*cover-summary-rail-mark/g)).toHaveLength(2)
})
it('places each option above its own roll and repeats only shared attack modes', async () => {
  const attack = await render(WeaponRollControls, { scope: 'attack', options: weaponDamageMenuOptions(actions, [], false, 'attack'), versatile: true })
  const damage = await render(WeaponRollControls, { scope: 'damage', options: weaponDamageMenuOptions(actions, []), versatile: true })
  expect(attack).toContain('aria-label="Метнуть"')
  for (const text of ['Критическое попадание', 'Двумя руками', 'Цель — великан', 'Добавит', 'При попадании']) expect(attack).not.toContain(text)
  for (const text of ['Критическое попадание', 'Двумя руками', 'Цель — великан', 'aria-label="Метнуть"', 'Добавит +1к8']) expect(damage).toContain(text)
  expect(attack.indexOf('aria-label="Метнуть"')).toBeLessThan(attack.indexOf('Бросить на атаку'))
  expect(damage.indexOf('Цель — великан')).toBeLessThan(damage.indexOf('Бросить на урон'))
})

it('keeps options out of the top-level weapon menu until a submenu opens', async () => {
  // The browser-only popover unregisters listeners even while initially closed.
  vi.stubGlobal('document', { removeEventListener: vi.fn() })
  vi.stubGlobal('window', { removeEventListener: vi.fn() })
  try {
    const html = await render(DamageRollOptions, { actions, canAttack: true, versatile: true })
    expect(html).toContain('Бросить на атаку')
    expect(html).toContain('Бросить на урон')
    for (const text of ['Критическое попадание', 'Двумя руками', 'Цель — великан', 'aria-label="Метнуть"']) expect(html).not.toContain(text)
  } finally { vi.unstubAllGlobals() }
})
