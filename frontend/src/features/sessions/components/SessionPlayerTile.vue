<template>
  <BaseTile :outlined="false" interactive class="session-player-tile" :class="{ 'session-player-tile--current': current, 'session-player-tile--compact': compact }"
    :style="{ '--player-color': color || 'transparent' }">
    <CharacterSummaryTile :name="name" :icon-url="avatarUrl" :action-label="`Действия: ${name}`" :compact="compact"
      :armor="showStats && !loading && !error ? stats.armorClass : undefined" :health-visible="healthVisible"
      :current="hp?.current" :maximum="hp?.max" :temporary="hp?.temp" :show-passives="showStats && !loading && !error"
      :perception="stats.passives[0]?.value" :investigation="stats.passives[1]?.value">
      <template #name-suffix><slot name="name-suffix" /><div v-if="controlsVisible" class="p-combat-controls" @click.stop @pointerdown.stop><slot name="controls" /></div></template>
      <template v-if="$slots.health" #health><slot name="health" /></template>
      <template #metrics><SkeletonBlock v-if="showStats && loading" width="110px" height="28px" /><span v-else-if="showStats && error" class="player-metric-error" role="alert">{{ error }}</span></template>
    </CharacterSummaryTile>
    <div v-if="hasStatuses && !compact" class="p-statuses-area"><slot name="statuses" /></div>
  </BaseTile>
</template>
<script setup>
import { BaseTile, SkeletonBlock } from '@sylvieshare/share-ui'
import CharacterSummaryTile from '@/features/character-editor/components/sheet/CharacterSummaryTile.vue'
import { useParticipantDefenses } from '../composables/useParticipantDefenses'
const props = defineProps({ participant: Object, name: String, avatarUrl: String, color: String, hp: Object,
  healthVisible: Boolean, showStats: Boolean, compact: Boolean, current: Boolean, controlsVisible: Boolean, hasStatuses: Boolean })
const { stats, loading, error } = useParticipantDefenses(() => props.participant, () => props.showStats)
</script>
<style scoped>
.session-player-tile.base-tile {padding:var(--spacing-small) var(--spacing-xs);min-width:0;width:100%;box-sizing:border-box;--tile-surface:var(--bg);background:var(--tile-surface);box-shadow:inset 3px 0 0 var(--player-color);overflow:hidden}
.session-player-tile--current.base-tile {--tile-surface:color-mix(in srgb,var(--accent) 12%,var(--bg))}
.session-player-tile--compact.base-tile {padding:calc(var(--spacing-medium) / 2);width:var(--layout-touch-min);height:var(--layout-touch-min)}
.p-combat-controls {display:flex;align-items:center;justify-content:center;width:var(--participant-selection-width,36px);flex:none;margin-left:auto}
.p-statuses-area {margin-top:var(--spacing-small);min-width:0;--status-scroll-inset-start:0px;--status-scroll-inset-end:0px}
.player-metric-error {font-size:var(--type-context-size);color:var(--danger)}
</style>
