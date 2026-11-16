<template>
  <BaseTile :outlined="false" interactive :color="color || 'var(--text-muted)'" class="session-roster-tile"
    :class="{'session-roster-tile--current':current,'session-roster-tile--compact':compact,'session-roster-tile--selecting':selectionMode,'session-roster-tile--selected':selected}"
    :style="{'--player-color':color || 'transparent'}">
    <CharacterSummaryTile :name="name" :icon-url="avatarUrl" :action-label="`Действия: ${name}`" :compact="compact" :armor="armor"
      :health-visible="healthVisible" :current="hp?.current" :maximum="hp?.max" :temporary="hp?.temp" :edit-health="editHealth"
      :show-passives="showPassives" :perception="perception" :investigation="investigation" @health="$emit('health')">
      <template v-if="$slots.portrait" #portrait><slot name="portrait" /></template>
      <template #name-prefix><slot name="name-prefix" /></template>
      <template #name-suffix><slot name="name-suffix" /></template>
      <template #metrics><slot name="metrics" /></template>
      <template v-if="$slots.health" #health><slot name="health" /></template>
    </CharacterSummaryTile>
    <div v-if="hasStatuses && !compact" class="p-statuses-area"><slot name="statuses" /></div>
  </BaseTile>
</template>
<script setup>
import { BaseTile } from '@sylvieshare/share-ui'
import CharacterSummaryTile from '@/features/character-editor/components/sheet/CharacterSummaryTile.vue'
defineProps({name:String,avatarUrl:String,color:String,hp:Object,armor:Number,healthVisible:Boolean,editHealth:Boolean,
  showPassives:Boolean,perception:Number,investigation:Number,current:Boolean,compact:Boolean,hasStatuses:Boolean,selectionMode:Boolean,selected:Boolean})
defineEmits(['health'])
</script>
<style scoped>
.session-roster-tile.base-tile {padding:var(--spacing-small) var(--spacing-xs);min-width:0;width:100%;box-sizing:border-box;--tile-surface:transparent;background:var(--tile-surface);border-radius:var(--radius-tile);box-shadow:inset 3px 0 0 var(--player-color);overflow:hidden}
.session-roster-tile--current.base-tile {--tile-surface:color-mix(in srgb,var(--accent) 12%,transparent)}
.session-roster-tile--compact.base-tile {padding:calc(var(--spacing-medium) / 2);width:var(--layout-touch-min);height:var(--layout-touch-min)}
.session-roster-tile--selecting.base-tile {box-shadow:inset 0 0 0 var(--layout-border) var(--border-strong);cursor:pointer}
.session-roster-tile--selected.session-roster-tile--selecting.base-tile {box-shadow:inset 0 0 0 calc(var(--layout-border) * 2) var(--accent);--tile-surface:color-mix(in srgb,var(--accent) 7%,transparent)}
.p-statuses-area {margin-top:var(--spacing-small);min-width:0;--status-scroll-inset-start:0px;--status-scroll-inset-end:0px}
</style>
