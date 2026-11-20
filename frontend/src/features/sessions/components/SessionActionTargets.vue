<template>
  <span class="action-target-preview" :style="{ '--action-target-groups': groups.length }" aria-hidden="true">
    <SessionSelectionPortraits :groups="groups" compact />
  </span>
</template>

<script setup>
import { computed } from 'vue'
import SessionSelectionPortraits from './SessionSelectionPortraits.vue'
import { selectedRosterGroups } from '../lib/selectedRosterGroups'

const props = defineProps({
  items: { type: Array, required: true },
  encounter: { type: Object, required: true },
})
const groups = computed(() => selectedRosterGroups(props.items, props.encounter))
</script>

<style scoped>
.action-target-preview {
  --selection-portrait-size: 20px;
  display: flex;
  inline-size: calc(var(--selection-portrait-size) * min(var(--action-target-groups), 3));
}
</style>
