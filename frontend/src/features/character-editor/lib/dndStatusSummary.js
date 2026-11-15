import { normalizeStatusInstances } from './characterStatuses'
import { normalizeExhaustion } from '../blocks/dnd/lib/exhaustion'
import { isInspirationActive } from '../blocks/dnd/lib/mobileStatus'
import { dndRules } from '@/shared/lib/dndRules'
import { statusDuration } from '@/shared/lib/statusDuration'

export function hasDndStatusSummary(values = {}) {
  return normalizeStatusInstances(values.states).length > 0
    || normalizeExhaustion(values.exhaustion).level > 0
    || isInspirationActive(values.inspiration)
}

export function dndStatusSummary({ statuses = [], values = {}, rulesVersion = '2014', itemByCode = () => null, exhaustionId = 'exhaustion', inspirationId = 'inspiration' } = {}) {
  const exhaustion = normalizeExhaustion(values[exhaustionId], rulesVersion)
  const exhaustionItem = itemByCode('exhaustion') || null, inspirationItem = itemByCode('inspiration') || null
  return [
    ...statuses.map(status => ({
      id: status.uid, kind: 'states', value: status.title, desc: status.description,
      thesis: status.item?.data?.thesis || status.description, color: status.color, item: status.item,
      level: Math.max(0, Number(status.params?.level ?? status.item?.data?.level) || 0),
      adjustableLevel: Number(status.item?.data?.level) > 0,
      maxLevel: Math.max(0, Number(status.item?.data?.max_level) || 0), polarity: status.polarity,
      duration: statusDuration(status.duration) + (status.requires_concentration && status.concentration_owner ? ' · концентрация отправителя' : status.concentration ? ' · концентрация' : ''),
    })),
    ...(exhaustion.level > 0 ? [{
      id: 'exhaustion', kind: 'exhaustion', polarity: 'negative',
      value: exhaustionItem?.name || 'Истощение', desc: exhaustion.effects.slice(0, exhaustion.level).join(' · '),
      thesis: exhaustionItem?.data?.thesis || '- Уровни накапливают штрафы\n- Продолжительный отдых снимает один уровень',
      color: exhaustionItem?.data?.color || 'var(--danger)', level: exhaustion.level,
      adjustableLevel: true, maxLevel: 6, item: exhaustionItem,
    }] : []),
    ...(isInspirationActive(values[inspirationId]) ? [{
      id: 'inspiration', kind: 'inspiration', polarity: 'positive',
      value: inspirationItem?.name || dndRules(rulesVersion).inspirationName,
      desc: inspirationItem?.data?.desc || '',
      thesis: inspirationItem?.data?.thesis || dndRules(rulesVersion).inspirationDescription,
      color: inspirationItem?.data?.color || 'var(--accent)', item: inspirationItem,
    }] : []),
  ]
}
