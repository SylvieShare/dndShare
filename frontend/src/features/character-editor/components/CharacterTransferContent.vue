<template>
    <div class="transfer-content" :aria-busy="state.busy">
      <p v-if="state.error" class="transfer-error" role="alert">{{ state.error }}</p>
      <LoadingIndicator v-if="state.loading" label="Загрузка игроков" />
      <template v-else-if="state.view === 'players'">
        <CharacterInteractionPlayers :players="controller.recipients" :controller="controller.interactions" />
      </template>
      <template v-else>
        <CharacterInteractionInbox v-if="controller.interactions" :controller="controller.interactions" :character-uuid="characterUuid" />
        <p v-if="!state.transfers.length && !controller.interactions?.state.pending.length" class="transfer-hint">Незавершённых событий нет.</p>
        <article v-for="transfer in state.transfers" :key="transfer.id" class="transfer-event">
          <div class="transfer-offer">
            <TransferPerson :name="transfer.senderName" :image-url="senderImage(transfer)" />
            <span class="transfer-offer-verb">предлагает</span>
            <button type="button" class="transfer-reference" @click="emit('view-item', itemView(transfer))">
              <ItemIcon v-if="artwork(transfer)?.iconImageUrl || artwork(transfer)?.svg" :item="artwork(transfer)" :size="32" />
              <Package v-else :size="32" :stroke-width="1.5" aria-hidden="true" />
              <strong>{{ transfer.itemName }}<span v-if="transfer.entry?.count > 1"> ×{{ transfer.entry.count }}</span></strong>
            </button>
          </div>
          <template v-if="transfer.recipientCharUuid === characterUuid">
            <div class="transfer-actions">
              <ActionButton :disabled="state.busy" @click="controller.resolve(transfer, 'accept')">Принять</ActionButton>
              <ActionButton variant="quiet" :disabled="state.busy" @click="controller.resolve(transfer, 'reject')">Отказаться</ActionButton>
            </div>
          </template>
          <template v-else>
            <span class="transfer-hint">Ожидает принятия</span>
            <ActionButton variant="quiet" :disabled="state.busy" @click="controller.resolve(transfer, 'reject')">Отозвать передачу</ActionButton>
          </template>
        </article>
      </template>
    </div>
</template>
<script setup>
import CharacterInteractionPlayers from './CharacterInteractionPlayers.vue'
import CharacterInteractionInbox from './CharacterInteractionInbox.vue'
import { computed, ref, watch } from 'vue'
import { Package } from '@lucide/vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import TransferPerson from '@/features/item-transfers/components/TransferPerson.vue'
import { itemsApi } from '@/shared/api/itemsApi'
import { ActionButton, LoadingIndicator } from '@sylvieshare/share-ui'
import { pvAvatar } from '@/features/sessions/lib/participantView'
const props = defineProps({ controller: { type: Object, required: true }, characterUuid: { type: String, required: true } })
const emit = defineEmits(['view-item'])
const state = computed(() => props.controller.state)
const items = ref({})
const itemId = transfer => Number(transfer.entry?.magic_item_id || transfer.entry?.item_id) || null
const artwork = transfer => items.value[itemId(transfer)]
function senderImage(transfer) {
  return transfer.senderImageUrl || pvAvatar(state.value.participants.find(player => player.charUuid === transfer.senderCharUuid)) || ''
}
function itemView(transfer) {
  const id = itemId(transfer)
  const typeId = { weapon: 1, items: 2, potions: 10 }[transfer.source] || 2
  const item = id ? artwork(transfer) || null : { name: transfer.itemName, typeId, data: transfer.entry?.override || {} }
  return { id, item, typeId: item?.typeId || typeId, entry: transfer.entry }
}
watch(() => [...new Set(state.value.transfers.map(itemId).filter(Boolean))].join(','), async (key, _, onCleanup) => {
  let active = true
  onCleanup(() => { active = false })
  const missing = key.split(',').filter(id => id && !items.value[id])
  if (!missing.length) return
  try {
    const response = await itemsApi.byIds(missing)
    if (active) items.value = { ...items.value, ...Object.fromEntries((response.items || []).map(item => [item.id, item])) }
  } catch { /* The reference dialog can retry loading; the item keeps a package icon. */ }
}, { immediate: true })
</script>
<style scoped>
.transfer-content { display: flex; flex-direction: column; gap: 16px; }
.transfer-content p { margin: 0; }
.transfer-event { display: flex; flex-direction: column; gap: 10px; overflow-wrap: anywhere; }
.transfer-offer { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 9px; }
.transfer-offer-verb { color: var(--text-muted); font-size: 13px; }
.transfer-event + .transfer-event { border-top: 1px solid var(--border); padding-top: 16px; }
.transfer-reference { display: flex; align-items: center; gap: 9px; min-width: 0; border: 0; padding: 0; background: none; color: var(--text-1); font: inherit; text-align: left; cursor: pointer; }
.transfer-reference > svg { flex: 0 0 32px; color: var(--accent-soft); }
.transfer-reference strong { min-width: 0; overflow-wrap: anywhere; font-size: 14px; text-decoration: underline; text-decoration-color: var(--border-strong); text-underline-offset: 4px; }
.transfer-reference:hover { color: var(--accent-soft); }
.transfer-reference:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; border-radius: var(--r-sm); }
.transfer-hint { color: var(--text-muted); font-size: 13px; line-height: 1.5; }
.transfer-error { color: var(--danger); }
.transfer-actions { display: flex; flex-wrap: wrap; gap: 8px; }
</style>
