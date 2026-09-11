import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createPinia } from 'pinia'
import { expect, it } from 'vitest'
import WeaponRollControls from './WeaponRollControls.vue'
import WeaponItemMechanics from './WeaponItemMechanics.vue'
import { weaponDamageMenuOptions } from '@/shared/lib/weaponDamageOptions'
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
  const ctx = { charCtx: { ownerMode: true }, weaponResources: () => [resource], item: () => ({ data: { recharge_note: 'На рассвете 1к3' } }) }
  const html = await render(WeaponItemMechanics, { entry: { uid: 'staff' } }, ctx)
  expect(html.match(/aria-label="Заряд /g)).toHaveLength(3)
  expect(html.match(/aria-pressed="true"/g)).toHaveLength(1)
  expect(html.match(/aria-pressed="false"/g)).toHaveLength(2)
  expect(html).toContain('На рассвете 1к3')
  ctx.charCtx.ownerMode = false
  const readonly = await render(WeaponItemMechanics, { entry: { uid: 'staff' } }, ctx)
  expect(readonly.match(/<button[^>]*disabled/g)).toHaveLength(3)
})
