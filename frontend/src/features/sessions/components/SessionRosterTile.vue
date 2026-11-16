<template>
  <BaseTile :outlined="false" interactive :color="color || 'var(--text-muted)'" class="session-roster-tile"
    :class="{'session-roster-tile--current':current,'session-roster-tile--compact':compact,'session-roster-tile--selecting':selectionMode,'session-roster-tile--selected':selected}"
    :style="{'--player-color':color || 'transparent','--roster-paint-default':defaultPaintClip,'--roster-ink-position':inkPosition}">
    <CharacterSummaryTile :name="name" :icon-url="avatarUrl" :action-label="`Действия: ${name}`" :compact="compact" :armor="armor"
      :health-visible="healthVisible" :current="hp?.current" :maximum="hp?.max" :temporary="hp?.temp" :edit-health="editHealth"
      :show-passives="showPassives" :perception="perception" :investigation="investigation" @health="$emit('health')">
      <template v-if="$slots.portrait" #portrait><slot name="portrait" /></template>
      <template v-if="$slots['portrait-overlay']" #portrait-overlay><slot name="portrait-overlay" /></template>
      <template #name-prefix><slot name="name-prefix" /></template>
      <template #name-suffix><slot name="name-suffix" /><span v-if="surprised" class="roster-surprised">врасплох</span></template>
      <template #metrics><slot name="metrics" /></template>
      <template v-if="$slots.health" #health><slot name="health" /></template>
    </CharacterSummaryTile>
    <div v-if="hasStatuses && !compact" class="p-statuses-area"><slot name="statuses" /></div>
  </BaseTile>
</template>
<script setup>
import { BaseTile } from '@sylvieshare/share-ui'
import { computed } from 'vue'
import { roughRowPaintStyle } from '@/shared/ui/roughRowSeam'
import CharacterSummaryTile from '@/features/character-editor/components/sheet/CharacterSummaryTile.vue'
const props=defineProps({name:String,avatarUrl:String,color:String,hp:Object,armor:Number,healthVisible:Boolean,editHealth:Boolean,
  showPassives:Boolean,perception:Number,investigation:Number,current:Boolean,compact:Boolean,hasStatuses:Boolean,selectionMode:Boolean,selected:Boolean,surprised:Boolean})
const defaultPaintClip=roughRowPaintStyle(0)['--roster-paint-clip']
const inkPosition=computed(()=>{
  let hash=0
  for(const letter of props.name || '')hash=(Math.imul(hash,31)+letter.codePointAt(0))>>>0
  return `${hash%101}% ${Math.floor(hash/101)%101}%`
})
defineEmits(['health'])
</script>
<style scoped>
.session-roster-tile.base-tile {padding:var(--spacing-small) var(--spacing-xs);min-width:0;width:100%;box-sizing:border-box;--tile-surface:transparent;background:var(--tile-surface);border-radius:0;box-shadow:inset 3px 0 0 var(--player-color);overflow:visible;isolation:isolate}
.session-roster-tile--current.base-tile {--tile-surface:color-mix(in srgb,var(--accent) 12%,transparent)}
.session-roster-tile--compact.base-tile {padding:calc(var(--spacing-medium) / 2);width:var(--layout-touch-min);height:var(--layout-touch-min)}
.session-roster-tile--selecting.base-tile {cursor:pointer}
.session-roster-tile.base-tile::before,.session-roster-tile.base-tile::after {content:'';position:absolute;inset:calc(var(--spacing-small) / -2) 0;z-index:-1;pointer-events:none;background:var(--accent);opacity:0;clip-path:var(--roster-paint-clip,var(--roster-paint-default));transition:opacity var(--motion-feedback)}
.session-roster-tile.base-tile::after {background:linear-gradient(to right,var(--accent),color-mix(in srgb,var(--accent) 25%,transparent) 32%,color-mix(in srgb,var(--accent) 25%,transparent) 86%,var(--accent));mask:url('@/assets/ui/roster-selection-stroke.svg') var(--roster-ink-position)/145% 165% no-repeat;-webkit-mask:url('@/assets/ui/roster-selection-stroke.svg') var(--roster-ink-position)/145% 165% no-repeat}
.session-roster-tile--selected.session-roster-tile--selecting.base-tile::before {opacity:.13}
.session-roster-tile--selected.session-roster-tile--selecting.base-tile::after {opacity:.34}
.p-statuses-area {margin-top:var(--spacing-small);min-width:0;--status-scroll-inset-start:0px;--status-scroll-inset-end:0px}
.roster-surprised {flex:none;color:var(--warning);font-size:var(--type-context-size)}
@media(prefers-reduced-motion:reduce){.session-roster-tile.base-tile::before,.session-roster-tile.base-tile::after{transition:none}}
</style>
