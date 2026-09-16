export const impactTargetKey = target => target.kind === 'npc' ? `npc:${target.encounterId}:${target.npcUid}` : `char:${target.charUuid}`
export const targetIdentity = ({ snapshot, hp, ...target }) => target
export function impactOutcome(event, target) {
  const row = event.data?.savingThrow?.results?.find(row => row.key === impactTargetKey(target))
  return row ? row.success ? 'success' : 'failure' : ''
}
export function impactForTarget(event, target) {
  return event.data?.impacts?.find(row => row.key === impactTargetKey(target))
}
