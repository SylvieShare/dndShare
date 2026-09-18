<template>
  <BaseTile v-if="top && ctx.itemTransfers" class="campaign-block" data-tutorial="character-session">
    <div class="campaign-heading">
      <span class="campaign-label" role="img" aria-label="Сессия" title="Сессия"><ScrollText :size="24" aria-hidden="true" /></span>
      <RouterLink :to="`/sessions/${top.uuid}`" class="campaign-name">{{ top.name }}</RouterLink>
    </div>
    <div class="campaign-actions">
      <div class="campaign-action">
        <ActionButton variant="quiet" icon-only class="campaign-icon" aria-label="Игроки" :title="`Игроки: ${playerCount ?? 'загрузка'}`" :ref="el => registerAnchor('players', el)" aria-haspopup="dialog" :aria-expanded="ctx.itemTransfers.state.view === 'players'" @click="toggle('players', $event)">
          <template #icon><Users class="campaign-symbol" :size="24" aria-hidden="true" /></template>
        </ActionButton>
        <span class="campaign-count" aria-hidden="true">{{ playerCount ?? '—' }}</span>
      </div>
      <div class="campaign-action">
        <ActionButton variant="quiet" icon-only class="campaign-icon" aria-label="События" :title="`События: ${eventCount}. Входящих: ${ctx.itemTransfers.incomingCount}`" :ref="el => registerAnchor('events', el)" aria-haspopup="dialog" :aria-expanded="ctx.itemTransfers.state.view === 'events'" @click="toggle('events', $event)">
          <template #icon><Bell class="campaign-symbol" :size="24" aria-hidden="true" /></template>
        </ActionButton>
        <span class="campaign-count" :class="{ 'campaign-count--pending': eventCount > 0 }" aria-hidden="true">{{ eventCount }}</span>
      </div>
    </div>
  </BaseTile>
</template>

<script setup>
import { computed, inject, onBeforeUnmount } from 'vue'
import { RouterLink } from 'vue-router'
import { ActionButton, BaseTile } from '@sylvieshare/share-ui'
import { Bell, ScrollText, Users } from '@lucide/vue'
defineProps(['block'])
const ctx = inject('charCtx', {})
const top = computed(() => ctx.topSession || null)
const playerCount = computed(() => ctx.itemTransfers.state.playersLoaded ? ctx.itemTransfers.recipients.length : null)
const eventCount = computed(() => ctx.itemTransfers.state.transfers.length + (ctx.itemTransfers.interactions?.state.pending.length || 0))
const anchors = new Map()
function registerAnchor(view, component) {
  const element = component?.$el
  if (anchors.get(view) === element) return
  ctx.itemTransfers.unregisterAnchor(view, anchors.get(view))
  anchors.set(view, element)
  if (element) ctx.itemTransfers.registerAnchor(view, element)
}
function toggle(view, event) {
  if (ctx.itemTransfers.state.view === view) ctx.itemTransfers.close()
  else ctx.itemTransfers.open(view, event.currentTarget)
}
onBeforeUnmount(() => anchors.forEach((element, view) => ctx.itemTransfers.unregisterAnchor(view, element)))
</script>

<style scoped>
.campaign-block { display: flex; flex-direction: column; align-items: stretch; gap: 6px; padding: 6px; }
.campaign-heading { display: flex; align-items: center; gap: 10px; min-width: 0; padding: 8px 8px 0; }
.campaign-label { display: flex; flex-shrink: 0; color: var(--text-muted); }
.campaign-name { color: var(--text-1); font-size: 18px; line-height: 1.3; font-weight: 650; text-decoration: none; overflow-wrap: anywhere; }
.campaign-name:hover { color: var(--accent); }
.campaign-actions { display: flex; justify-content: flex-start; gap: 12px; padding: 0 4px 4px 0; }
.campaign-action { position: relative; flex: 0 0 48px; }
.campaign-symbol { flex: 0 0 24px; width: 24px; height: 24px; }
.campaign-count { position: absolute; right: -5px; bottom: -5px; min-width: 21px; box-sizing: border-box; border: 2px solid var(--surface); border-radius: var(--r-pill); background: var(--surface-raised); color: var(--text-2); padding: 1px 5px; font-size: 10px; line-height: 15px; font-weight: 700; font-variant-numeric: tabular-nums; text-align: center; pointer-events: none; }
.campaign-count--pending { background: var(--accent); color: var(--text-on-accent); }
</style>
