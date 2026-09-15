<template>
  <MorphTile v-if="current" class="spell-concentration" title="Концентрация" :show-edit="false" aria-label="Концентрация">
    <template #aside>
      <ActionButton v-if="current && ctx.ownerMode" variant="quiet" :disabled="ctx.itemTransfers.busy" @click="controller.end()">Прекратить</ActionButton>
    </template>
    <p v-if="controller.state.error" role="alert">{{ controller.state.error }} <ActionButton variant="quiet" @click="controller.refresh()">Обновить</ActionButton></p>
    <div class="concentration-content">
      <HandbookReferenceRows :rows="[{ id: current.spellId }]" />
      <div v-if="current.effects.length" class="concentration-effects">
        <span class="concentration-caption">Связанные эффекты</span>
        <HandbookReferenceRows :rows="effectRows">
          <template #leading="{ row }">
            <span class="concentration-target" :title="row.target.name" :aria-label="row.target.name"><ItemIcon v-if="row.target.imageUrl || row.target.svg" :item="{ iconImageUrl: row.target.imageUrl, svg: row.target.svg }" :size="36" /><UserRound v-else :size="28" /><NpcMarker v-if="row.target.kind === 'npc'" :letter="row.target.letter" :color="row.target.color" /></span>
          </template>
        </HandbookReferenceRows>
      </div>
      <p v-else>Связанных эффектов пока нет.</p>
    </div>
  </MorphTile>
</template>
<script setup>
import { computed, inject } from 'vue'
import { UserRound } from '@lucide/vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import { ActionButton, MorphTile } from '@sylvieshare/share-ui'
import HandbookReferenceRows from '@/features/items/components/HandbookReferenceRows.vue'
import NpcMarker from '@/features/sessions/components/NpcMarker.vue'
const ctx = inject('charCtx', {})
const controller = computed(() => ctx.itemTransfers?.concentration)
const current = computed(() => controller.value?.state.current)
const effectRows = computed(() => (current.value?.effects || []).map(effect => ({ id: effect.effectId, key: effect.uid, target: effect.target })))
</script>
<style scoped>
.spell-concentration { margin-bottom: 16px; }
.concentration-content { display: grid; gap: 10px; }
.spell-concentration p { margin: 0; font-size: 13px; color: var(--text-muted); line-height: 1.5; }
.concentration-effects { display: grid; gap: 8px; border-left: 2px solid var(--border); padding-left: 10px; }
.concentration-caption { font-size: 12px; color: var(--text-muted); }
.concentration-target { display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: 13px; }
</style>
