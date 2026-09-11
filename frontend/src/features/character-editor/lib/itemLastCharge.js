import { inventoryEntries, mapOwnedEntries, MAGIC_VALUE_ID } from './characterMagicItems'

export function lastChargeRuleError(rule) {
  if (!rule || !/^d(4|6|8|10|12|20|100)$/.test(rule.dice || '')) return 'Выберите одну кость для проверки.'
  const max = Number(rule.failure_max)
  if (!Number.isInteger(max) || max < 1 || max > Number(rule.dice.slice(1))) return 'Опасный результат должен находиться в пределах кости.'
  if (rule.consequence !== 'lose_magic') return 'Выберите последствие проверки.'
  return ''
}

/** Called only by spending paths, after the counter patch has been prepared. */
export function queueLastCharge(values, item, resource, available) {
  if (resource.source?.valueId !== MAGIC_VALUE_ID || resource.value <= 0 || available !== 0) return {}
  const rule = item?.data?.last_charge
  if (lastChargeRuleError(rule) || String(rule.resource_key || '') !== String(resource.source.resourceKey || '')) return {}
  const entry = inventoryEntries(values).find(row => row.entry.uid === resource.source.entryKey)?.entry
  if (!entry || entry.params?.magic?.lost || entry.params?.magic?.last_charge_check?.status === 'pending') return {}
  const check = { id: crypto.randomUUID(), status: 'pending', rule: { ...rule }, source_name: item.name, created_at: new Date().toISOString() }
  return mapOwnedEntries(values, row => row.uid === entry.uid
    ? { ...row, params: { ...row.params, magic: { ...row.params?.magic, last_charge_check: check } } } : row)
}

export function resolveLastCharge(values, uid, checkId, result) {
  const entry = inventoryEntries(values).find(row => row.entry.uid === uid)?.entry
  const check = entry?.params?.magic?.last_charge_check
  if (!check || check.id !== checkId || check.status !== 'pending' || lastChargeRuleError(check.rule)) return {}
  if (!Number.isInteger(result) || result < 1 || result > Number(check.rule.dice.slice(1))) return {}
  const lost = result <= Number(check.rule.failure_max)
  return mapOwnedEntries(values, row => row.uid === uid ? { ...row, params: { ...row.params, magic: {
    ...row.params?.magic, lost,
    last_charge_check: { ...check, status: 'resolved', result, lost, resolved_at: new Date().toISOString() },
  } } } : row)
}

/** Undo an accidental application without refunding charges or rerolling the same event. */
export function undoLastCharge(values, uid, checkId) {
  const entry = inventoryEntries(values).find(row => row.entry.uid === uid)?.entry
  const check = entry?.params?.magic?.last_charge_check
  if (!check || check.id !== checkId || !['pending', 'resolved'].includes(check.status)) return {}
  return mapOwnedEntries(values, row => row.uid === uid ? { ...row, params: { ...row.params, magic: {
    ...row.params?.magic, lost: false, last_charge_check: { ...check, status: 'undone', undone_at: new Date().toISOString() },
  } } } : row)
}
