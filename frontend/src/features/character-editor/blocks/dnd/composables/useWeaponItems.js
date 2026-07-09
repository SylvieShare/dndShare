import { ref } from 'vue'
import { itemsApi } from '@/shared/api/itemsApi'

export function useWeaponItems({ tagMap, tagDetailsMap }) {
  const itemMap = ref({})

  function item(entry) {
    return itemMap.value[entry.item_id] || null
  }

  function itemTitle(entry) {
    return item(entry)?.name || `#${entry.item_id || '—'}`
  }

  function itemSubtitle(entry) {
    const it = item(entry)
    return it?.data?.subtype || it?.data?.type || ''
  }

  function rangeLabel(entry) {
    const data = item(entry)?.data || {}
    const { range_min: min, range_max: max } = data
    if (min == null && max == null) return ''
    if (min != null && max != null) return `дист. ${min}/${max} фт.`
    return `дист. ${min ?? max} фт.`
  }

  function propertyItems(entry) {
    const data = item(entry)?.data || {}
    const tags = Array.isArray(data.tags) ? data.tags : []
    return tags.map(tag => {
      if (tag && typeof tag === 'object') {
        return {
          id:    tag.id ?? tag.value,
          label: tag.value || tag.label || tag.name || String(tag.id ?? ''),
          desc:  tag.desc || '',
        }
      }
      const td = tagDetailsMap.value[tag] || {}
      return {
        id:    tag,
        label: td.value || tagMap.value[tag] || String(tag),
        desc:  td.desc || '',
      }
    }).filter(p => p.label)
  }

  function itemBaseAttacks(entry) {
    const data = item(entry)?.data || {}
    if (Array.isArray(data.attacks)) return data.attacks
    if (Array.isArray(data.add_attacks)) return data.add_attacks
    return []
  }

  // Versatile / two-handed damage dice (schema `universe_attacks`, set when the «Универсальное» tag is on).
  function itemTwoHandedAttacks(entry) {
    const data = item(entry)?.data || {}
    return Array.isArray(data.universe_attacks) ? data.universe_attacks : []
  }

  async function loadItems(entries) {
    const ids = [...new Set(entries.map(e => e.item_id).filter(Boolean))]
    const missing = ids.filter(id => !itemMap.value[id])
    if (!missing.length) return
    const res = await itemsApi.byIds(missing)
    const next = { ...itemMap.value }
    for (const it of res.items || []) next[it.id] = it
    itemMap.value = next
  }

  function addItem(it) {
    itemMap.value = { ...itemMap.value, [it.id]: it }
  }

  return {
    itemMap,
    item,
    itemTitle,
    itemSubtitle,
    rangeLabel,
    propertyItems,
    itemBaseAttacks,
    itemTwoHandedAttacks,
    loadItems,
    addItem,
  }
}
