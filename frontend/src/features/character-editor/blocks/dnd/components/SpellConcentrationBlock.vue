<template>
  <section v-if="controller" class="spell-concentration" aria-label="Концентрация">
    <header>
      <Focus :size="18" aria-hidden="true" />
      <strong>Концентрация</strong>
      <ActionButton v-if="current && ctx.ownerMode" variant="quiet" :disabled="ctx.itemTransfers.busy" @click="controller.end()">Прекратить</ActionButton>
    </header>
    <p v-if="controller.state.error" role="alert">{{ controller.state.error }} <ActionButton variant="quiet" @click="controller.refresh()">Обновить</ActionButton></p>
    <template v-if="current">
      <HandbookReferenceRows :rows="[{ id: current.spellId }]" />
      <div v-if="current.effects.length" class="concentration-effects">
        <span class="concentration-caption">Связанные эффекты</span>
        <HandbookReferenceRows :rows="effectRows">
          <template #description="{ row }">
            <span class="concentration-target"><NpcMarker v-if="row.target.kind === 'npc'" :letter="row.target.letter" :color="row.target.color" />{{ row.target.name }}</span>
          </template>
        </HandbookReferenceRows>
      </div>
      <p v-else>Связанных эффектов пока нет.</p>
    </template>
    <p v-else>{{ controller.state.loading ? 'Загрузка…' : 'Вы не поддерживаете концентрацию.' }}</p>
  </section>
</template>
<script setup>
import { computed, inject } from 'vue'
import { Focus } from '@lucide/vue'
import { ActionButton } from '@sylvieshare/share-ui'
import HandbookReferenceRows from '@/features/items/components/HandbookReferenceRows.vue'
import NpcMarker from '@/features/sessions/components/NpcMarker.vue'
const ctx = inject('charCtx', {})
const controller = computed(() => ctx.itemTransfers?.concentration)
const current = computed(() => controller.value?.state.current)
const effectRows = computed(() => (current.value?.effects || []).map(effect => ({ id: effect.effectId, key: effect.uid, target: effect.target })))
</script>
<style scoped>
.spell-concentration { border: 1px solid var(--border); border-radius: 10px; padding: 12px; display: grid; gap: 10px; }
.spell-concentration header { display: flex; align-items: center; gap: 8px; color: var(--accent-soft); }
.spell-concentration header strong { flex: 1; }
.spell-concentration p { margin: 0; font-size: 13px; color: var(--text-muted); line-height: 1.5; }
.concentration-effects { display: grid; gap: 8px; border-left: 2px solid var(--border); padding-left: 10px; }
.concentration-caption { font-size: 12px; color: var(--text-muted); }
.concentration-target { display: flex; align-items: center; gap: 6px; font-size: 13px; }
</style>
