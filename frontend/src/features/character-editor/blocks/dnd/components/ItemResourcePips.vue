<template>
  <div class="item-resource">
    <span v-if="label">{{ label }}</span>
    <div class="item-resource-pips" role="group" :aria-label="`${resource.title}: ${resource.value} из ${resource.total}`">
      <button v-for="pip in resource.total" :key="pip" type="button" :disabled="!interactive" :aria-label="`Заряд ${pip}`" :aria-pressed="pip <= resource.value" @click="$emit('toggle', pip)">
        <SpellSlotSphere :spent="pip > resource.value" :size="28" :color="resource.color_point" :interactive="interactive" />
      </button>
    </div>
    <ResourceRestIcons :resource="resource" />
  </div>
</template>
<script setup>
import SpellSlotSphere from '@/features/items/components/SpellSlotSphere.vue'
import ResourceRestIcons from '@/features/character-editor/blocks/generic/components/ResourceRestIcons.vue'
defineProps({ resource: Object, interactive: Boolean, label: String })
defineEmits(['toggle'])
</script>
<style scoped>
.item-resource { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 10px; }
.item-resource > span { color: var(--text-2); font-size: 11px; font-weight: 650; }
.item-resource-pips { display: flex; gap: 4px; flex-wrap: wrap; }
.item-resource-pips > button { display: inline-flex; border: 0; padding: 0; background: none; border-radius: 6px; cursor: pointer; }
.item-resource-pips > button:disabled { cursor: default; }
.item-resource-pips > button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>
