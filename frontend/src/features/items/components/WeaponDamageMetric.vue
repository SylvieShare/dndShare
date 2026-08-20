<template>
  <span v-if="damage" class="weapon-damage-metric" :aria-label="damage.label">
    <span v-if="damage.count !== 1" class="weapon-damage-metric__count">{{ damage.count }}</span>
    <SystemDie
      v-if="damage.diceSides"
      :sides="damage.diceSides"
      :size="size"
      :animated="false"
    />
    <span v-else class="weapon-damage-metric__label">{{ damage.label }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue'
import SystemDie from '@/shared/ui/SystemDie.vue'
import { diceById } from '@/shared/lib/systemDice'

const props = defineProps({
  attack: { type: Object, default: null },
  size: { type: Number, default: 34 },
})

const damage = computed(() => {
  if (!props.attack) return null
  const count = Math.max(1, Number(props.attack.count) || 1)
  const die = diceById(props.attack.dice_id)
  if (!die) return { count, diceSides: null, label: String(count) }
  return { count, diceSides: die.sides, label: `${count}${die.value}` }
})
</script>

<style scoped>
.weapon-damage-metric {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 0;
  color: var(--text-1);
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
}
.weapon-damage-metric__count { min-width: 8px; text-align: right; }
.weapon-damage-metric__label { font-variant-numeric: tabular-nums; }
</style>
