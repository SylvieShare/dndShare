import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createPinia } from 'pinia'
import { expect, it } from 'vitest'
import MagicRuleFields from './MagicRuleFields.vue'
import { useSuggestStore } from '@/stores/suggest'
import schema from '../../../../../resources/items/item_19_shema.json'
it('shows named spells, defenses, dice and explicit prohibitions without technical keys', async () => {
  const data = {
    granted_spells: [{ spell: 99, slotless: true }],
    defenses: [{ damage_type: 3, kind: 'resistance' }],
    weapon_damage: [{ key: 'hidden_key', label: 'Пламя', dice: 'd6', dice_count: 2 }],
    derived_effects: [{ kind: 'armor_bonus', value: 2, allow_shield: false }],
  }
  const pinia = createPinia()
  useSuggestStore(pinia).set(12, [{ id: 3, value: 'Огонь' }])
  const app = createSSRApp({ render: () => h(MagicRuleFields, { fields: schema, data, items: { 99: { name: 'Свет' } } }) })
  app.use(pinia)
  const html = await renderToString(app)
  for (const text of ['Свет', 'Огонь', 'Сопротивление', 'Пламя', 'd6', 'Разрешён щит', 'Нет']) expect(html).toContain(text)
  for (const text of ['hidden_key', 'dd6', '[object Object]']) expect(html).not.toContain(text)
})
