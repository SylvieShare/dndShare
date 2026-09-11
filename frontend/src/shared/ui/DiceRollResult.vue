<template>
  <div class="dice-roll-result" :aria-label="`Результат броска: ${result.total}`">
    <template v-for="(part, index) in result.parts || []" :key="index">
      <span v-if="index || part.sign === '-'">{{ part.sign || '+' }}</span>
      <template v-if="part.kind === 'dice'">
        <template v-for="(value, i) in part.rolls" :key="i">
          <span v-if="i">+</span>
          <SystemDie :sides="part.sides" :value="value" :size="size" :animated="false" :color="part.color || 'var(--accent-soft)'" />
        </template>
      </template>
      <span v-else :style="{ color: part.color }">{{ part.value }}</span>
    </template>
    <strong>= {{ result.total }}</strong>
  </div>
</template>
<script setup>
import SystemDie from './SystemDie.vue'
defineProps({ result: { type: Object, required: true }, size: { type: Number, default: 28 } })
</script>
<style scoped>
.dice-roll-result { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; color: var(--text-2); }
.dice-roll-result strong { white-space: nowrap; color: var(--text-1); font-size: 16px; margin-left: 3px; }
</style>
