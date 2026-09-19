import { getSaveTargets } from '@/shared/api/sessionEventsApi'
import { itemsApi } from '@/shared/api/itemsApi'
import { inventoryEntries } from '@/features/character-editor/lib/characterMagicItems'
import { armorBaseId } from '@/features/character-editor/lib/magicArmor'
import { collectStatusDerivedEffects } from '@/features/character-editor/lib/characterStatuses'
import { participantDefenses } from './participantDefenses'
import { saveTargetItemIds } from './sessionSaveRoll'
export async function loadSessionTargets(uuid, suggest) {
  const targets = (await getSaveTargets(uuid)).targets || []
  await suggest.ensure(3)
  const items = new Map()
  async function load(ids) {
    const unique = [...new Set(ids.filter(Boolean).map(String))].filter(id => !items.has(id))
    for (let i = 0; i < unique.length; i += 100) for (const item of (await itemsApi.byIds(unique.slice(i, i + 100))).items || []) items.set(String(item.id), item)
  }
  await load(targets.flatMap(target => [...saveTargetItemIds(target), ...inventoryEntries(target.snapshot?.values || {}).flatMap(({ entry }) => [entry.item_id, entry.magic_item_id])]))
  await load(targets.flatMap(target => inventoryEntries(target.snapshot?.values || {}).map(({ entry }) => armorBaseId(items.get(String(entry.magic_item_id ?? entry.item_id)), entry))))
  return { items, targets: targets.map(target => ({ ...target, armorClass: targetArmorClass(target, items, type => suggest.items(type)) })) }
}
export function targetArmorClass(target, items, suggestItems) {
  if (!target.snapshot) return null
  if (target.kind !== 'npc') return participantDefenses(target.snapshot.values || {}, items, suggestItems, target.snapshot.rulesVersion || '2014').armorClass
  const c = target.snapshot.combatant || {}, base = c.override?.ac ?? target.snapshot.item?.combat?.ac
  if (base == null || base === '') return null
  return Number(base) + collectStatusDerivedEffects({ states: c.effectInstances || [] }, items).filter(rule => rule.kind === 'armor_bonus').reduce((sum, rule) => sum + (Number(rule.value) || 0), 0)
}
