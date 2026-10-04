import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createPinia } from 'pinia'
import { expect, it, vi } from 'vitest'
import WeaponRollControls from './WeaponRollControls.vue'
import WeaponItemMechanics from './WeaponItemMechanics.vue'
import { weaponDamageMenuOptions } from '@/shared/lib/weaponDamageOptions'
vi.mock('@/features/items/components/ItemEffectLinks.vue', () => ({ default: { render: () => h('div', 'Связанный эффект') } }))
const action = { key: 'wither', label: 'Иссушающий удар', dice: 'd10', dice_count: 2, uses_resource: true, resource_cost: 1,
  resource: { key: 'staff', title: 'Посох', value: 1, total: 3, color_point: 'var(--accent)' } }
async function render(component, props, ctx) {
  const app = createSSRApp({ render: () => h(component, props) })
  app.use(createPinia())
  if (ctx) app.provide('weaponsBlockCtx', ctx)
  return renderToString(app)
}
it('renders small charge cells with minus alongside dice, and no cost on the attack side', async () => {
  const html = await render(WeaponRollControls, { options: weaponDamageMenuOptions([action], [], true) })
  expect(html).toContain('aria-label="Добавит +4к10"')
  expect(html).toContain('aria-label="Расход: 1"')
  expect(html).toContain('−')
  expect(html).toContain('width:22px;height:22px')
  expect(html).toContain('--dd-size:26px')
  const attack = await render(WeaponRollControls, { scope: 'attack', options: weaponDamageMenuOptions([{ ...action, attack_mode: 'thrown' }], [], false, 'attack') })
  expect(attack).not.toContain('Расход:')
})
it('blocks the damage roll when a selected cost is no longer affordable', async () => {
  const empty = { ...action, resource: { ...action.resource, value: 0 } }
  const html = await render(WeaponRollControls, { options: weaponDamageMenuOptions([empty], ['wither']) })
  expect(html).toContain('Недостаточно ресурса')
  expect(html).toMatch(/<button[^>]*disabled[^>]*>[\s\S]*Бросить на урон/)
  expect(html).not.toMatch(/<button(?=[^>]*disabled)(?=[^>]*aria-label="Иссушающий удар")/)
})
it('displays the instance pool below the weapon with filled and spent accessible cells', async () => {
  const resource = { ...action.resource, source: {} }
  const ctx = { charCtx: { ownerMode: true, values: { lvl: { level: 5 } } }, weaponResources: () => [resource], item: () => ({ id: 273, typeId: 19, data: { attunement: 'none', max_use: 3, status_effects: [{ key: 'terror', effect: { id: 4615 } }] } }) }
  const html = await render(WeaponItemMechanics, { entry: { uid: 'staff' } }, ctx)
  expect(html.match(/aria-label="Заряд /g)).toHaveLength(3)
  expect(html.match(/aria-pressed="true"/g)).toHaveLength(1)
  expect(html.match(/aria-pressed="false"/g)).toHaveLength(2)
  expect(html).not.toContain('На рассвете 1к3')
  expect(html).not.toContain('>Ресурс<')
  expect(html).not.toContain('item-mechanic-panel--resource')
  expect(html).toContain('>Эффекты оружия<')
  expect(html).toMatch(/<summary[^>]*>[\s\S]*?Эффекты оружия[\s\S]*?Заряд 1[\s\S]*?<\/summary>/)
  expect(html).toMatch(/<details(?![^>]*\bopen\b)/)
  ctx.charCtx.ownerMode = false
  const readonly = await render(WeaponItemMechanics, { entry: { uid: 'staff' } }, ctx)
  expect(readonly.match(/<button[^>]*disabled/g)).toHaveLength(3)
})

it('renders the structured curse below only the attuned weapon in owner and read modes', async () => {
  const item = { id: 99, typeId: 19, data: { weapon_notes: [{ key: 'vengeance', kind: 'curse', when: 'attuned', title: 'Мстительный дух', description: '<p>Мудрость, Сл 15.</p>' }] } }
  const ctx = { charCtx: { ownerMode: true }, weaponResources: () => [], itemMap: { 99: item }, item: () => item }
  const entry = { uid: 'sword', magic_item_id: 99, params: { magic: { attuned: true } } }
  for (const ownerMode of [true, false]) {
    ctx.charCtx.ownerMode = ownerMode
    const html = await render(WeaponItemMechanics, { entry }, ctx)
    expect(html).toContain('Проклятие')
    expect(html).toContain('Мстительный дух')
    expect(html).toContain('Мудрость, Сл 15.')
    expect(html).toMatch(/<details(?![^>]*\bopen\b)/)
  }
  const inactive = await render(WeaponItemMechanics, { entry: { ...entry, params: { magic: { attuned: false } } } }, ctx)
  expect(inactive).not.toContain('Мстительный дух')
  expect(inactive).not.toContain('weapon-item-mechanics')
})

it('keeps two-handed grip visible but disabled while throwing, and disables throwing during two-handed grip', async () => {
  const throwing = await render(WeaponRollControls, { versatile: true, thrown: true, options: [] })
  expect(throwing).toMatch(/<button(?=[^>]*disabled)(?=[^>]*aria-label="Двумя руками")/)
  const options = weaponDamageMenuOptions([{ key: 'throw', label: 'Метнуть', attack_mode: 'thrown' }], [], false, 'damage', true)
  expect(options[0].disabled).toBe(true)
  const grip = await render(WeaponRollControls, { versatile: true, twoHanded: true, options })
  expect(grip).toMatch(/<button(?=[^>]*disabled)(?=[^>]*aria-label="Метнуть")/)
  expect(grip).not.toMatch(/<button(?=[^>]*disabled)(?=[^>]*aria-label="Двумя руками")/)
  expect(weaponDamageMenuOptions([{ key: 'throw', attack_mode: 'thrown' }], [], false, 'damage', false)[0].disabled).toBe(false)
})

it('offers bonus action damage only on eligible damage menus and excludes two-handed grip', async () => {
  const bonusActionOption = { hint: 'Положительный модификатор характеристики не добавляется.' }
  const damage = await render(WeaponRollControls, { bonusActionOption, bonusAction: true, versatile: true })
  expect(damage).toContain('Урон бонусным действием')
  expect(damage).toContain(bonusActionOption.hint)
  expect(damage).toMatch(/<button(?=[^>]*disabled)(?=[^>]*aria-label="Двумя руками")/)
  const twoHanded = await render(WeaponRollControls, { bonusActionOption, twoHanded: true, versatile: true })
  expect(twoHanded).toMatch(/<button(?=[^>]*disabled)(?=[^>]*aria-label="Урон бонусным действием")/)
  for (const props of [{}, { scope: 'attack', bonusActionOption }]) {
    expect(await render(WeaponRollControls, props)).not.toContain('Урон бонусным действием')
  }
})
