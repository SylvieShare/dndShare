<template>
  <div class="resource-amount" role="group" :aria-label="label">
    <button v-for="cell in units.max" :key="cell" type="button" :aria-label="`${label}: ${cell} ${unit ?? (cell === 1 ? 'заряд' : 'заряда')}`"
      :aria-pressed="cell <= units.value" :disabled="cell > units.value && (disabled || cell > units.available)"
      :title="cell <= units.value ? `Уменьшить до ${cell - 1}` : `Выбрать ${cell}`"
      @click.stop="$emit('change', cell <= units.value ? cell - 1 : cell)">
      <SpellSlotSphere :size="26" :spent="cell > units.value" :color="units.color" :interactive="true" />
    </button>
  </div>
</template>
<script setup>
import SpellSlotSphere from '@/features/items/components/SpellSlotSphere.vue'
defineProps({ units: { type: Object, required: true }, label: String, unit: String, disabled: Boolean })
defineEmits(['change'])
</script>
<style scoped>
.resource-amount { display: inline-flex; align-items: center; gap: 3px; }
.resource-amount button { display: inline-flex; padding: 0; border: 0; background: none; border-radius: 5px; cursor: pointer; }
.resource-amount button:disabled { opacity: .35; cursor: not-allowed; }
.resource-amount button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>
