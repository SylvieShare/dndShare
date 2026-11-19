<template>
  <div class="shop-step">
    <WizardShop :items="startingShopItems" :loading="shopLoading" :categories="categories" :category-of="categoryOf" :cart-count="cartCount">
      <template #item="{ item }">
        <WizardShopOffer :item-type="typeById(item.typeId)" :item="item" :count="purchaseQuantity(item)" :price="priceLabel(item)"
          :disabled="!canBuyShopItem(item)" @buy="buy(item)" @details="viewItem = item" />
      </template>
      <template #budget>
        <MultiToggle v-if="startingWealthFormulaLabel" :model-value="wealthMode" aria-label="Способ определения богатства" :options="wealthOptions" @update:model-value="requestReroll" />
        <div class="wealth-copy">
          <span class="wealth-kicker">Начальное богатство{{ wealthMode === 'roll' ? ' · ' + startingWealthFormulaLabel : '' }}</span>
          <strong>{{ state.startingWealthRoll?.gold || 0 }} зм</strong>
          <div v-if="state.startingWealthRoll?.rolls?.length" class="wealth-rolls">
            <SystemDie v-for="(roll, index) in state.startingWealthRoll.rolls" :key="index" :sides="4" :value="roll" :size="34" :animated="false" />
            <small>× {{ state.startingWealthRoll.multiplier }}</small>
          </div>
        </div>
        <button v-if="wealthMode === 'roll'" type="button" class="reroll" @click="requestReroll('roll')">
          <Dices :size="17" aria-hidden="true" />
          Перебросить
        </button>
        <div class="wealth-totals">
          <span><small>Потрачено</small>{{ shopSpentLabel }}</span>
          <span class="remaining"><small>Останется в кошельке</small>{{ shopRemainingLabel }}</span>
        </div>
      </template>
      <template #cart>
        <WizardShopCartLine v-for="entry in state.startingShopCart" :key="`${entry.item_id}:${JSON.stringify(entry.params)}`"
          :item-type="typeById(entry.typeId)" :item="entry" :name="instanceName(entry)" :price="priceLabel(entry) + (packagingNote(entry) ? ' / ' + purchaseQuantity(entry) + ' шт.' : '')"
          @details="viewItem = entry" @remove="removeShopItem(entry)">
          <template #quantity>
            <button type="button" aria-label="Уменьшить" @click="bumpShopItem(entry, -1)">−</button>
            <strong>{{ entry.count }}</strong>
            <button type="button" aria-label="Увеличить" :disabled="!canBuyShopItem(entry)" @click="bumpShopItem(entry, 1)">+</button>
          </template>
        </WizardShopCartLine>
      </template>
      <template #totals>
        <span>Итого <strong>{{ shopSpentLabel }}</strong></span>
        <span>Остаток <strong>{{ shopRemainingLabel }}</strong></span>
      </template>
    </WizardShop>

    <MagicEquipmentInstanceModal v-if="pendingPurchase" :item="pendingPurchase" @close="pendingPurchase = null" @confirm="confirmPurchase" />
    <ItemViewModal
      v-if="viewItem"
      :item="viewItem"
      :item-id="viewItem.item_id ?? viewItem.id"
      :item-type-id="viewItem.typeId"
      @close="viewItem = null"
    />
    <ConfirmDialog
      v-if="rerollConfirmOpen"
      title="Изменить начальное богатство?"
      message="Текущая корзина очистится, и бюджет будет рассчитан заново."
      confirm-label="Изменить"
      @cancel="rerollConfirmOpen = false"
      @confirm="confirmReroll"
    />
  </div>
</template>

<script setup>
import { MultiToggle } from '@sylvieshare/share-ui'
import { computed, inject, ref } from 'vue'
import { Dices } from '@lucide/vue'
import { ConfirmDialog } from '@sylvieshare/share-ui'
import WizardShop from '../WizardShop.vue'
import SystemDie from '@/shared/ui/SystemDie.vue'
import WizardShopCartLine from '../WizardShopCartLine.vue'
import WizardShopOffer from '../WizardShopOffer.vue'
import MagicEquipmentInstanceModal from '@/features/items/components/MagicEquipmentInstanceModal.vue'
import { initialChargeStocks } from '@/shared/lib/itemInitialCharges'
import { magicEquipmentKinds } from '@/features/items/lib/magicEquipmentBases'
import ItemViewModal from '@/features/handbook/components/ItemViewModal.vue'
import { formatCopper, itemCostCopper } from '@/features/character-editor/settings/dnd/creation/startingShop'
import { packagingNote, purchaseQuantity } from '@/features/items/lib/itemPackaging'

const {
  state, shopLoading, typeById, startingShopItems, startingWealthFormulaLabel,
  shopSpentLabel, shopRemainingLabel,
  addShopItem, removeShopItem, bumpShopItem, canBuyShopItem, rerollStartingWealth,
} = inject('createWizard')

const TYPE_LABELS = [
  { id: 2, label: 'Снаряжение' },
  { id: 14, label: 'Инструменты' },
  { id: 1, label: 'Оружие' },
  { id: 12, label: 'Доспехи' },
  { id: 10, label: 'Зелья' },
  { id: 13, label: 'Транспорт' },
  { id: 19, label: 'Магические предметы' },
]
const categories = computed(() => TYPE_LABELS.map(group => ({ ...group, type: typeById(group.id) })))
const categoryOf = item => Number(item.typeId)
const wealthMode = computed(() => state.startingWealthRoll?.rolls?.length ? 'roll' : 'fixed')
const wealthOptions = [{ value: 'fixed', label: 'По умолчанию' }, { value: 'roll', label: 'Бросок' }]
const pendingMode = ref('roll')
const viewItem = ref(null)
const pendingPurchase = ref(null)
function buy(item) { if (magicEquipmentKinds(item).length || initialChargeStocks(item.data).length) pendingPurchase.value = item; else addShopItem(item) }
function confirmPurchase(params) { addShopItem({ ...pendingPurchase.value, params }); pendingPurchase.value = null }
const rerollConfirmOpen = ref(false)
const cartCount = computed(() => state.startingShopCart.reduce((sum, entry) => sum + Math.max(1, Number(entry.count) || 1), 0))
const priceLabel = (item) => formatCopper(itemCostCopper(item))
const instanceName = (entry) => entry.params?.length_ft != null ? `${entry.name} · ${entry.params.length_ft} фт.` : entry.name

function requestReroll(mode) {
  pendingMode.value = mode
  if (state.startingShopCart.length) rerollConfirmOpen.value = true
  else rerollStartingWealth(pendingMode.value)
}
function confirmReroll() { rerollConfirmOpen.value = false; rerollStartingWealth(pendingMode.value) }
</script>

<style scoped>
.wealth-rolls { display: flex; align-items: center; gap: 5px; }
.wealth-rolls small { color: var(--text-muted); font-size: 11px; }
.reroll { align-self: center; display: inline-flex; align-items: center; gap: 7px; padding: 8px 11px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface-raised); color: var(--text-1); font: inherit; font-size: 12px; font-weight: 650; cursor: pointer; }
.reroll:hover { border-color: var(--warning); color: var(--warning); }
</style>
