<template>
  <ObjectListItem :item="item" :name-en="item.nameEn || ''" :custom="item.userId != null" :subtitle="subtitle">
    <template #leading><ObjectTypeIcon :type="type" /></template>
    <template v-if="damage" #trailing>
      <span class="wli-damage">
        <template v-if="damage.iconUrl">
          <span v-if="damage.count !== 1" class="wli-count">{{ damage.count }}</span>
          <span class="wli-dice" v-html="damage.iconUrl" aria-hidden="true"></span>
        </template>
        <template v-else>{{ damage.label }}</template>
      </span>
    </template>
  </ObjectListItem>
</template>

<script setup>
import { computed } from 'vue'
import ObjectListItem from '@/features/items/list-components/ObjectListItem'
import ObjectTypeIcon from '@/features/items/list-components/ObjectTypeIcon'
import { findField, getSuggestId } from '@/features/handbook/objects/lib/schemaFields'
import { useSuggestStore } from '@/stores/suggest'

const props = defineProps({
  item: { type: Object, required: true },
  type: { type: Object, default: null },
})

const suggestStore = useSuggestStore()

function suggestItems(fieldKey) {
  const sid = getSuggestId(findField(props.type?.fields, fieldKey))
  return sid != null ? suggestStore.items(sid) : []
}

const diceDetailsMap = computed(() => Object.fromEntries(suggestItems('dice_id').map(s => [s.id, s])))
const damageTypeMap = computed(() => Object.fromEntries(suggestItems('type').map(s => [s.id, s.value])))
const tagMap = computed(() => Object.fromEntries(suggestItems('tags').map(s => [s.id, s.value])))

const data = computed(() => props.item.data || {})
const firstAttack = computed(() => Array.isArray(data.value.attacks) ? data.value.attacks[0] : null)

const damage = computed(() => attackDamage(firstAttack.value))
const damageType = computed(() => firstAttack.value
  ? (damageTypeMap.value[firstAttack.value.type] || firstAttack.value.type || '')
  : '')

const tagLabels = computed(() =>
  (Array.isArray(data.value.tags) ? data.value.tags : [])
    .map(id => tagMap.value[id] || String(id))
    .filter(Boolean)
)

const subtitle = computed(() => {
  const parts = [damageType.value, ...tagLabels.value].filter(Boolean)
  return parts.join(' · ')
})

function attackDamage(attack) {
  if (!attack) return null
  const count = Number(attack.count) || 1
  const dice = diceDetailsMap.value[attack.dice_id] || null
  const diceLabel = dice?.value || ''
  if (!diceLabel) return { count, diceLabel: '', iconUrl: '', label: String(count) }
  return { count, diceLabel, iconUrl: dice?.svg || '', label: `${count}${diceLabel}` }
}
</script>

<style scoped>
.wli-damage {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px 2px 4px;
  border: 1px solid rgba(162,146,255,0.18);
  border-radius: 6px;
  background: rgba(162,146,255,0.09);
  color: #d0d0dc;
  font-size: 11px;
  font-weight: 700;
}

.wli-count { min-width: 8px; text-align: right; }

.wli-dice {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.wli-dice :deep(svg) { width: 22px; height: 22px; }
</style>
