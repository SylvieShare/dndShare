<template>
  <span class="save-target-name">
    <ItemIcon v-if="target.imageUrl || target.svg" :item="{ iconImageUrl: target.imageUrl, svg: target.svg }" :size="28" />
    <UserRound v-else :size="24" />
    <NpcMarker v-if="target.kind === 'npc'" :letter="target.letter" :color="target.color" />
    <span>{{ target.name }}</span>
  </span>
</template>
<script setup>
import { UserRound } from '@lucide/vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import NpcMarker from './NpcMarker.vue'
defineProps({ target: Object })
</script>
<style scoped>
.save-target-name { display: inline-flex; align-items: center; gap: 6px; min-width: 0; color: var(--text-1); }
.save-target-name span { overflow-wrap: anywhere; }
</style>
