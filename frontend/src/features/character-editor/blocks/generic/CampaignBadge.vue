<template>
  <BaseTile v-if="top && ctx.itemTransfers" framed class="campaign-block" data-tutorial="character-session">
    <div class="campaign-heading">
      <span class="campaign-label">Сессия</span>
      <RouterLink :to="`/sessions/${top.uuid}`" class="campaign-name">{{ top.name }}</RouterLink>
    </div>
    <div class="campaign-actions">
      <div class="campaign-action">
        <ActionButton variant="quiet" class="campaign-icon" aria-label="Игроки" :title="`Игроки: ${playerCount ?? 'загрузка'}`" @click="ctx.itemTransfers.open('players')">
          <template #icon><Users class="campaign-symbol" :size="24" aria-hidden="true" /></template>
        </ActionButton>
        <span class="campaign-count" aria-hidden="true">{{ playerCount ?? '—' }}</span>
      </div>
      <div class="campaign-action">
        <ActionButton variant="quiet" class="campaign-icon" aria-label="События" :title="`События: ${eventCount}. Входящих: ${ctx.itemTransfers.incomingCount}`" @click="ctx.itemTransfers.open('events')">
          <template #icon><Bell class="campaign-symbol" :size="24" aria-hidden="true" /></template>
        </ActionButton>
        <span class="campaign-count" :class="{ 'campaign-count--pending': eventCount > 0 }" aria-hidden="true">{{ eventCount }}</span>
      </div>
    </div>
  </BaseTile>
</template>

<script setup>
import { computed, inject } from 'vue'
import { RouterLink } from 'vue-router'
import { ActionButton, BaseTile } from '@sylvieshare/share-ui'
import { Bell, Users } from '@lucide/vue'
defineProps(['block'])
const ctx = inject('charCtx', {})
const top = computed(() => ctx.topSession || null)
const playerCount = computed(() => ctx.itemTransfers.state.playersLoaded ? ctx.itemTransfers.state.participants.length : null)
const eventCount = computed(() => ctx.itemTransfers.state.transfers.length)
</script>

<style scoped>
.campaign-block { display: flex; flex-direction: column; align-items: stretch; gap: 12px; padding: 18px; }
.campaign-heading { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.campaign-label { color: var(--text-muted); font-size: 10px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
.campaign-name { color: var(--text-1); font-size: 18px; line-height: 1.3; font-weight: 650; text-decoration: none; overflow-wrap: anywhere; }
.campaign-name:hover { color: var(--accent); }
.campaign-actions { display: flex; flex-shrink: 0; gap: 14px; padding: 0 4px 4px 0; }
.campaign-action { position: relative; flex: 0 0 48px; }
.campaign-actions .campaign-icon { width: 48px; height: 48px; padding: 0; gap: 0; }
.campaign-symbol { flex: 0 0 24px; width: 24px; height: 24px; }
.campaign-count { position: absolute; right: -5px; bottom: -5px; min-width: 21px; box-sizing: border-box; border: 2px solid var(--surface); border-radius: var(--r-pill); background: var(--surface-raised); color: var(--text-2); padding: 1px 5px; font-size: 10px; line-height: 15px; font-weight: 700; font-variant-numeric: tabular-nums; text-align: center; pointer-events: none; }
.campaign-count--pending { background: var(--accent); color: var(--text-on-accent); }
</style>
