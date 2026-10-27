<template>
  <div class="sheet-row character-mobile-summary">
    <CharacterBlock :block="definition.blocks.hp" :values="values" :options="{ variant: 'compact' }"
      @update:value="emit('update:value', $event)" />
    <CharacterBlock :block="definition.blocks.mobile_statuses" :values="values" style="flex: 1; min-width: 0"
      @update:value="emit('update:value', $event)" />
  </div>
</template>
<script setup>
import CharacterBlock from '../CharacterBlock.vue'
defineProps({ definition: Object, values: Object })
const emit = defineEmits(['update:value'])
</script>
<style scoped>
.character-mobile-summary { gap: 8px; }
</style>
