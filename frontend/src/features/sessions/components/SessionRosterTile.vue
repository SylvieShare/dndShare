<template>
  <BaseTile :outlined="false" :color="color || 'var(--text-muted)'" class="session-roster-tile"
            :class="{'session-roster-tile--current':current,'session-roster-tile--on-scene':stageBackdrop,'session-roster-tile--compact':compact,'session-roster-tile--selectable':selectable && !compact,'session-roster-tile--selected':selected}"
            :style="{'--player-color':color || 'transparent','--roster-paint-default':defaultPaintClip,'--roster-ink-position':inkPosition}">
    <span v-if="stageBackdrop" class="roster-stage-backdrop" role="img" :aria-label="stageDescription"><Swords aria-hidden="true" :stroke-width="1.25" /></span>
    <div v-if="selectable && !compact" class="roster-select-zone" @click.stop="$emit('select')" @pointerdown.stop @keydown.stop>
      <CompactCheckbox :model-value="selected" :size="layoutTokens['roster-checkbox-icon']" :hit-size="layoutTokens['touch-min']" :label="`Выбрать: ${name}`" @update:model-value="$emit('select')" />
    </div>
    <div class="roster-content">
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
      <slot name="presence" />
      <div v-if="hasStatuses && !compact" class="p-statuses-area"><slot name="statuses" /></div>
    </div>
  </BaseTile>
</template>
<script setup>
import { BaseTile, CompactCheckbox } from '@sylvieshare/share-ui'
import { computed } from 'vue'
import { Swords } from '@lucide/vue'
import { layoutTokens } from '@/app/design-tokens'
import { roughRowPaintStyle } from '@/shared/ui/roughRowSeam'
import CharacterSummaryTile from '@/features/character-editor/components/sheet/CharacterSummaryTile.vue'
const props=defineProps({name:String,avatarUrl:String,color:String,hp:Object,armor:Number,healthVisible:Boolean,editHealth:Boolean,
  showPassives:Boolean,perception:Number,investigation:Number,current:Boolean,compact:Boolean,hasStatuses:Boolean,selectable:Boolean,selected:Boolean,surprised:Boolean,stageBackdrop:Boolean,stageDescription:String})
const defaultPaintClip=roughRowPaintStyle(0)['--roster-paint-clip']
const inkPosition=computed(()=>{
  let hash=0
  for(const letter of props.name || '')hash=(Math.imul(hash,31)+letter.codePointAt(0))>>>0
  return `${hash%101}% ${Math.floor(hash/101)%101}%`
})
defineEmits(['health','select'])
</script>
<style scoped>
.session-roster-tile.base-tile {padding:var(--spacing-small) var(--spacing-xs);min-width:0;width:100%;box-sizing:border-box;--tile-surface:transparent;--roster-state-color:var(--accent);--roster-state-opacity:0;background:transparent;border-radius:0;box-shadow:inset 3px 0 0 var(--player-color);overflow:visible;isolation:isolate;cursor:pointer;display:grid;grid-template-columns:minmax(0,1fr)}
.session-roster-tile--current.base-tile {--roster-state-color:var(--warning);--roster-state-opacity:.05}
.session-roster-tile--compact.base-tile {padding:calc(var(--spacing-medium) / 2);width:var(--layout-touch-min);height:var(--layout-touch-min)}
.session-roster-tile--selectable.base-tile {grid-template-columns:var(--layout-touch-min) minmax(0,1fr)}
.roster-select-zone {box-sizing:border-box;display:flex;justify-content:center;align-items:flex-start;min-height:var(--layout-touch-min);padding-top:calc((var(--summary-avatar-size,var(--layout-sheet-header-icon)) - var(--layout-roster-checkbox-icon)) / 2);touch-action:pan-y}
.roster-content {min-width:0}
.roster-stage-backdrop {position:absolute;inset:calc(var(--spacing-small) / -2) 0;z-index:-2;pointer-events:none;overflow:hidden;clip-path:var(--roster-paint-clip,var(--roster-paint-default))}
.roster-stage-backdrop svg {position:absolute;inset-inline-end:var(--spacing-small);top:50%;transform:translateY(-50%);width:var(--layout-roster-stage-watermark);height:100%;max-height:var(--layout-roster-stage-watermark);color:var(--text-2);opacity:.16;transition:opacity var(--motion-feedback)}
.session-roster-tile--selected .roster-stage-backdrop svg {opacity:.28}
@media(--ui-phone){.session-roster-tile--selectable {--summary-avatar-size:var(--layout-touch-min);--creature-avatar-size:var(--layout-touch-min)}}
.session-roster-tile.base-tile::before,.session-roster-tile.base-tile::after {content:'';position:absolute;inset:calc(var(--spacing-small) / -2) 0;z-index:-1;pointer-events:none;background:var(--accent);opacity:0;clip-path:var(--roster-paint-clip,var(--roster-paint-default));transition:opacity var(--motion-feedback)}
.session-roster-tile.base-tile::before {background:var(--roster-state-color);opacity:var(--roster-state-opacity)}
.session-roster-tile.base-tile::after {background:linear-gradient(to right,var(--accent),color-mix(in srgb,var(--accent) 25%,transparent) 32%,color-mix(in srgb,var(--accent) 25%,transparent) 86%,var(--accent));mask:url('@/assets/ui/roster-selection-stroke.svg') var(--roster-ink-position)/145% 165% no-repeat;-webkit-mask:url('@/assets/ui/roster-selection-stroke.svg') var(--roster-ink-position)/145% 165% no-repeat}
@media(hover:hover){.session-roster-tile.base-tile:hover {--roster-state-color:var(--tile-color);--roster-state-opacity:.11}.session-roster-tile--current.base-tile:hover {--roster-state-color:var(--warning);--roster-state-opacity:.1}}
.session-roster-tile--selected.session-roster-tile.base-tile {--roster-state-color:var(--accent);--roster-state-opacity:.13}
.session-roster-tile--selected.session-roster-tile.base-tile::after {opacity:.34}
.p-statuses-area {margin-top:var(--spacing-small);min-width:0;--status-scroll-inset-start:0px;--status-scroll-inset-end:0px}
.roster-surprised {flex:none;color:var(--warning);font-size:var(--type-context-size)}
@media(prefers-reduced-motion:reduce){.session-roster-tile.base-tile::before,.session-roster-tile.base-tile::after,.roster-stage-backdrop svg{transition:none}}
</style>
