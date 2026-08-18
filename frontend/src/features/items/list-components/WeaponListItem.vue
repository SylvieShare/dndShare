<template>
  <ObjectListItem :item="item" :type="type" :name-en="item.nameEn || ''" :custom="item.userId != null" :subtitle="subtitle">
    <template v-if="damage" #trailing>
      <span class="wli-damage">
        <template v-if="damage.diceSides">
          <span v-if="damage.count !== 1" class="wli-count">{{ damage.count }}</span>
          <SystemDie :sides="damage.diceSides" :size="24" />
        </template>
        <template v-else>{{ damage.label }}</template>
      </span>
    </template>
  </ObjectListItem>
</template>

<script setup>
import { computed } from 'vue'
import ObjectListItem from '@/features/items/list-components/ObjectListItem'
import { useSchemaSuggests } from '@/features/handbook/objects/lib/useSchemaSuggests'
import SystemDie from '@/shared/ui/SystemDie.vue'
import { diceById } from '@/shared/lib/systemDice'

const props = defineProps({
  item: { type: Object, required: true },
  type: { type: Object, default: null },
})

const { suggestItems } = useSchemaSuggests(() => props.type)

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
  const dice = diceById(attack.dice_id)
  const diceLabel = dice?.value || ''
  if (!diceLabel) return { count, diceLabel: '', diceSides: null, label: String(count) }
  return { count, diceLabel, diceSides: dice.sides, label: `${count}${diceLabel}` }
}
</script>

<style scoped>
.wli-damage {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px 2px 4px;
  border: 1px solid color-mix(in srgb, var(--accent-soft) 18%, transparent);
  border-radius: 6px;
  background: color-mix(in srgb, var(--accent-soft) 9%, transparent);
  color: var(--text-1);
  font-size: 11px;
  font-weight: 700;
}

.wli-count { min-width: 8px; text-align: right; }

</style>
