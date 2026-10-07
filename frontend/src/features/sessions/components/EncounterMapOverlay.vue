<template>
  <div class="encounter-map-overlay">
    <EncounterTurnPreview :combatant="currentCombatant" @view-participant="emit('view-participant', $event)" />
    <section class="initiative-track" aria-label="Линия инициативы">
      <div class="initiative-track-heading">
        <strong>Инициатива · раунд {{ enc.encounter.round }}</strong>
        <ActionButton variant="quiet" :disabled="!items.length" @click="toggleSelection">
          <ListChecks :size="17" />{{ allSelected ? 'Снять выбор' : 'Выбрать всех' }}
        </ActionButton>
      </div>
      <div ref="track" class="initiative-track-rows" data-sortable-container="combat">
        <div v-for="(combatant, index) in items" :key="combatant.uid" :data-sortable-slot="index" class="initiative-track-slot">
          <EncounterRow :combatant="combatant" section="combat" :idx="index" :order="index + 1"
            :is-current="combatant.uid === enc.currentTurnUid" />
        </div>
        <span v-if="!items.length" class="initiative-track-empty">В бою пока нет участников</span>
      </div>
    </section>
  </div>
</template>
<script setup>
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ActionButton } from '@sylvieshare/share-ui'
import { ListChecks } from '@lucide/vue'
import EncounterRow from './EncounterRow.vue'
import EncounterTurnPreview from './EncounterTurnPreview.vue'
const emit = defineEmits(['view-participant'])
const enc = inject('encounter')
onMounted(() => { enc.combatTrackLayout = true })
onBeforeUnmount(() => { enc.combatTrackLayout = false })
const track = ref(null)
const items = computed(() => enc.sortable.displayItems('combat'))
const currentCombatant = computed(() => enc.inCombat.find(c => c.uid === enc.currentTurnUid) || null)
const allSelected = computed(() => items.value.length > 0 && items.value.every(c => enc.isSelected(c)))
function toggleSelection() {
  const select = !allSelected.value
  for (const c of items.value) if (enc.isSelected(c) !== select) enc.toggleSelected(c)
}
watch(() => enc.currentTurnUid, async uid => {
  await nextTick()
  const row = [...(track.value?.querySelectorAll('[data-encounter-uid]') || [])].find(element => element.dataset.encounterUid === uid)
  if (!row || !track.value) return
  track.value.scrollTo({ left: Math.max(0, row.offsetLeft - (track.value.clientWidth - row.clientWidth) / 2), behavior: 'auto' })
}, { immediate: true })
</script>
<style scoped>
.encounter-map-overlay { position: absolute; inset: 144px 0 0; pointer-events: none; }
.encounter-map-overlay > :deep(.turn-preview) { position: absolute; top: 0; right: 0; width: min(320px, 100%); height: auto; max-height: calc(100% - 174px); pointer-events: auto; }
.encounter-map-overlay :deep(.turn-preview-hero) { padding: 12px; gap: 9px; }
.encounter-map-overlay :deep(.turn-preview-hero .enc-avatar) { width: 54px; height: 54px; flex: 0 0 54px; }
.encounter-map-overlay :deep(.turn-preview-identity strong) { font-size: 16px; }
.initiative-track { --section-color: var(--danger); position: absolute; bottom: 0; left: 0; right: 0; padding: 8px; border: 1px solid var(--border); border-radius: 12px; background: color-mix(in srgb, var(--surface) 94%, transparent); pointer-events: auto; }
.initiative-track-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--text-muted); font-size: 11px; }
.initiative-track-rows { position: relative; display: flex; align-items: flex-start; gap: 8px; overflow: auto; max-height: 124px; padding: 8px 0; }
.initiative-track-slot { flex: 0 0 390px; min-width: 0; }
.initiative-track-empty { padding: 12px; color: var(--text-muted); }
@media (max-width: 760px) {
  .encounter-map-overlay { top: 160px; }
  .encounter-map-overlay > :deep(.turn-preview) { width: min(260px, 100%); }
  .initiative-track-slot { flex-basis: 340px; }
}
</style>
