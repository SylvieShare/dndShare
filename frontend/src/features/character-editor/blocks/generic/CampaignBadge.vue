<template>
  <BaseTile v-if="top && ctx.itemTransfers" class="campaign-block" data-tutorial="character-session">
    <RouterLink :to="`/sessions/${top.uuid}`" class="campaign-name">{{ top.name }}</RouterLink>
    <div class="campaign-actions">
      <ActionButton variant="quiet" @click="ctx.itemTransfers.open('players')"><Users :size="16" />Игроки</ActionButton>
      <ActionButton variant="quiet" @click="ctx.itemTransfers.open('events')">
        <Bell :size="16" />События
        <span v-if="ctx.itemTransfers.state.transfers.length" class="campaign-count" :aria-label="`Входящих: ${ctx.itemTransfers.incomingCount}`">{{ ctx.itemTransfers.state.transfers.length }}</span>
      </ActionButton>
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
</script>

<style scoped>
.campaign-block { display: flex; flex-direction: column; gap: 10px; padding: 14px; }
.campaign-name { color: var(--text-1); font-size: 17px; font-weight: 650; text-decoration: none; overflow-wrap: anywhere; }
.campaign-name:hover { color: var(--accent); }
.campaign-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.campaign-count { min-width: 18px; border-radius: var(--r-pill); background: var(--accent); color: var(--text-on-accent); padding: 0 5px; font-size: 11px; text-align: center; }
</style>
