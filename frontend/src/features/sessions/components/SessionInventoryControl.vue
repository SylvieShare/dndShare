<template>
  <button ref="trigger" type="button" class="inventory-trigger" :class="{ active: open }" title="Инвентарь" aria-label="Инвентарь" :aria-expanded="open" @click="open = !open">
    <Backpack :size="24" /><span>Инвентарь</span>
  </button>
  <BasePopover :open="open" :anchor="trigger" :min-width="0" placement="right-start" :close-on-scroll="false" :close-on-resize="false" role="dialog" aria-label="Инвентарь сессии" transition-preset="action-menu" @update:open="!state.busy && (open = $event)">
    <section class="session-inventory" :aria-busy="state.busy">
      <header><strong>Инвентарь сессии</strong><RemoveButton label="Закрыть инвентарь" :disabled="state.busy" @click="open = false" /></header>
      <p v-if="state.error" role="alert" class="inventory-error">{{ state.error }} <ActionButton v-if="state.retry" variant="quiet" :disabled="state.busy" @click="state.retry()">Повторить</ActionButton></p>
      <div class="inventory-add"><ActionButton :disabled="state.busy" @click="open = false; picker = true">Добавить предмет</ActionButton><ActionButton variant="quiet" :disabled="state.busy" @click="custom = !custom">Свой предмет</ActionButton></div>
      <form v-if="custom" class="inventory-custom" @submit.prevent="addCustom">
        <FormField label="Название"><FormTextInput v-model:value="name" required maxlength="160" /></FormField>
        <FormField label="Количество"><FormNumberInput v-model:value="count" :min="1" :max="999" /></FormField>
        <FormField label="Описание"><FormTextarea v-model:value="description" /></FormField>
        <ActionButton type="submit" :disabled="state.busy || !name.trim()">Добавить</ActionButton>
      </form>
      <LoadingState v-if="state.loading && !state.entries.length && !state.transfers.length" label="Загружаем инвентарь…" compact />
      <p v-else-if="!state.entries.length" class="inventory-hint">Инвентарь пуст</p>
      <SessionInventoryRow v-for="row in state.entries" :key="row.id" :row="row" :item="art(row)" :players="state.players" :busy="state.busy" :controller="controller" @view="viewItem" @remove="controller.remove" />
      <template v-if="state.transfers.length">
        <h3>Передачи</h3>
        <article v-for="offer in state.transfers" :key="offer.id" class="inventory-offer">
          <TransferPerson :name="offer.senderCharUuid ? offer.senderName : offer.recipientName" :image-url="offer.senderImageUrl" />
          <button class="inventory-offer-item" type="button" @click="viewItem({ ...offer, name: offer.itemName })"><ItemIcon v-if="art(offer)" :item="art(offer)" :size="32" /><Package v-else :size="28" />{{ offer.itemName }}<span v-if="offer.entry?.count > 1"> ×{{ offer.entry.count }}</span></button>
          <TransferDecisionActions v-if="offer.addressedToDm" :busy="state.busy" @accept="controller.resolve(offer, 'accept')" @reject="controller.resolve(offer, 'reject')" />
          <div v-else class="inventory-outgoing"><span>Ожидает принятия</span><ActionButton variant="quiet" :disabled="state.busy" @click="controller.resolve(offer, 'reject')">Отозвать</ActionButton></div>
        </article>
      </template>
    </section>
  </BasePopover>
  <ItemPickerModal v-if="picker" title="Добавить в инвентарь сессии" :item-type-ids="[2, 1, 10, 19]" :allow-quantity="false" configure-instance @pick="add" @close="picker = false; open = true" />
  <ItemViewModal v-if="view" :item-id="view.id" :item="view.item" :item-type-id="view.typeId" @close="view = null; open = true" />
</template>
<script setup>
import { ref, toRef, watch } from 'vue'
import { Backpack, Package } from '@lucide/vue'
import { ActionButton, BasePopover, FormField, FormNumberInput, FormTextInput, FormTextarea, LoadingState, RemoveButton } from '@sylvieshare/share-ui'
import { useSessionInventory } from '../composables/useSessionInventory'
import SessionInventoryRow from './SessionInventoryRow.vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import ItemPickerModal from '@/features/handbook/components/ItemPickerModal.vue'
import ItemViewModal from '@/features/handbook/components/ItemViewModal.vue'
import TransferPerson from '@/features/item-transfers/components/TransferPerson.vue'
import TransferDecisionActions from '@/features/item-transfers/components/TransferDecisionActions.vue'
const props = defineProps({ sessionUuid: { type: String, required: true } })
const controller = useSessionInventory(toRef(props, 'sessionUuid'))
const state = controller.state
const trigger = ref(null), open = ref(false), picker = ref(false), custom = ref(false), view = ref(null)
const name = ref(''), count = ref(1), description = ref('')
const itemId = row => Number(row.entry?.magic_item_id || row.entry?.item_id) || null
const art = row => state.items[itemId(row)]
watch(open, value => { if (value) void controller.open() })
watch(() => props.sessionUuid, () => { open.value = picker.value = custom.value = false; view.value = null })
async function add(...args) { picker.value = false; open.value = true; await controller.add(...args) }
async function addCustom() { if (await controller.addCustom(name.value.trim(), Number(count.value), description.value)) { custom.value = false; name.value = ''; count.value = 1; description.value = '' } }
function viewItem(row) {
  const id = itemId(row), typeId = { items: 2, weapon: 1, potions: 10 }[row.source]
  view.value = { id, typeId, item: id ? art(row) || null : { name: row.name, typeId, data: row.entry?.override || {} } }
  open.value = false
}
</script>
<style scoped>
.inventory-trigger { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; min-height: 54px; padding: 5px 0; border: 0; background: transparent; color: var(--text-muted); cursor: pointer; }
.inventory-trigger span { font: 700 10px/1.2 var(--font-ui); }
.inventory-trigger:hover, .inventory-trigger.active { color: var(--text-1); }
.session-inventory { width: min(540px, calc(100vw - 32px)); max-height: calc(100dvh - 80px); overflow-y: auto; padding: 16px; box-sizing: border-box; display: flex; flex-direction: column; gap: 12px; }
.session-inventory header, .inventory-add, .inventory-outgoing { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
.session-inventory header strong { color: var(--text-1); font-size: 18px; }
.inventory-custom { display: grid; gap: 10px; }
.inventory-error { color: var(--danger); font-size: 13px; margin: 0; }
.inventory-hint, .inventory-outgoing span { color: var(--text-muted); font-size: 13px; }
.session-inventory h3 { color: var(--text-1); margin: 8px 0 0; font-size: 14px; }
.inventory-offer { display: grid; gap: 12px; padding-block: 12px; border-top: 1px solid var(--border); }
.inventory-offer-item { display: flex; align-items: center; gap: 8px; border: 0; background: none; padding: 0; color: var(--text-1); text-align: left; font: inherit; cursor: pointer; }
</style>
