<template>
  <div class="save-target-name">
    <ItemIcon v-if="target.imageUrl || target.svg" :item="{ iconImageUrl: target.imageUrl, svg: target.svg }" :size="iconSize" />
    <component v-else :is="target.kind === 'npc' ? PawPrint : UserRound" :size="iconSize" class="save-target-placeholder" />
    <div class="save-target-details">
      <span class="save-target-label"><NpcMarker v-if="target.kind === 'npc'" :letter="target.letter" :color="target.color" />{{ target.name }}</span>
      <template v-if="showHp">
        <SessionHpBar v-if="target.hp" :hp="target.hp" />
        <span v-else class="save-target-hp-unknown">ХП: —</span>
      </template>
    </div>
  </div>
</template>
<script setup>
import { PawPrint, UserRound } from '@lucide/vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import NpcMarker from './NpcMarker.vue'
import SessionHpBar from './SessionHpBar.vue'
defineProps({ target: Object, iconSize: { type: Number, default: 28 }, showHp: Boolean })
</script>
<style scoped>
.save-target-name { display: inline-flex; align-items: center; gap: 8px; min-width: 0; color: var(--text-1); }
.save-target-placeholder { flex-shrink: 0; }
.save-target-details { flex: 1; min-width: 0; }
.save-target-label { display: flex; align-items: center; gap: 6px; overflow-wrap: anywhere; }
.save-target-hp-unknown { color: var(--text-muted); font-size: 12px; }
</style>
