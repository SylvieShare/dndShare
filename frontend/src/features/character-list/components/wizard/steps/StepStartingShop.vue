<template>
  <div class="shop-step">
    <section class="wealth-card">
      <div class="wealth-copy">
        <span class="wealth-kicker">Начальное богатство · {{ startingWealthFormulaLabel }}</span>
        <strong>{{ state.startingWealthRoll?.gold || 0 }} зм</strong>
        <div v-if="state.startingWealthRoll?.rolls?.length" class="wealth-rolls">
          <span v-for="(roll, index) in state.startingWealthRoll.rolls" :key="index">{{ roll }}</span>
          <small>× {{ state.startingWealthRoll.multiplier }}</small>
        </div>
      </div>
      <button type="button" class="reroll" @click="requestReroll">
        <Dices :size="17" aria-hidden="true" />
        Перебросить
      </button>
      <div class="wealth-totals">
        <span><small>Потрачено</small>{{ shopSpentLabel }}</span>
        <span class="remaining"><small>Останется в кошельке</small>{{ shopRemainingLabel }}</span>
      </div>
    </section>

    <div class="shop-layout">
      <section class="shop-catalogue">
        <div class="shop-toolbar">
          <label class="shop-search">
            <Search :size="16" aria-hidden="true" />
            <input v-model="query" placeholder="Найти снаряжение…" />
          </label>
          <div class="shop-tabs" role="tablist" aria-label="Категории магазина">
            <button
              v-for="category in categories"
              :key="category.id"
              type="button"
              :class="{ active: activeType === category.id }"
              @click="activeType = category.id"
            >{{ category.label }} <small>{{ category.count }}</small></button>
          </div>
        </div>

        <div v-if="shopLoading" class="shop-empty">Загружаем каталог…</div>
        <div v-else-if="!visibleItems.length" class="shop-empty">В этой категории ничего не найдено.</div>
        <div v-else class="shop-items">
          <div v-for="item in visibleItems" :key="item.id" class="shop-item">
            <ItemReferenceRow
              :item="item"
              :params="item.params"
              roomy-weapon
              @activate="viewItem = item"
            />
            <button
              type="button"
              class="shop-add"
              :disabled="!canBuyShopItem(item)"
              :title="canBuyShopItem(item) ? `Купить за ${priceLabel(item)}` : 'Не хватает монет'"
              @click="addShopItem(item)"
            >
              <Plus :size="15" aria-hidden="true" />
              {{ priceLabel(item) }}
            </button>
          </div>
        </div>
      </section>

      <aside class="cart">
        <div class="cart-heading">
          <div>
            <span>Корзина</span>
            <small>{{ cartCountLabel }}</small>
          </div>
          <ShoppingBasket :size="20" aria-hidden="true" />
        </div>
        <div v-if="!state.startingShopCart.length" class="cart-empty">Добавляйте предметы из каталога. Покупки сразу считаются в бюджете.</div>
        <div v-else class="cart-items">
          <div v-for="entry in state.startingShopCart" :key="`${entry.item_id}:${JSON.stringify(entry.params)}`" class="cart-item">
            <button class="cart-name" type="button" @click="viewItem = entry">{{ instanceName(entry) }}</button>
            <span class="cart-price">{{ priceLabel(entry) }}</span>
            <div class="cart-quantity">
              <button type="button" aria-label="Уменьшить" @click="bumpShopItem(entry, -1)">−</button>
              <strong>{{ entry.count }}</strong>
              <button type="button" aria-label="Увеличить" :disabled="!canBuyShopItem(entry)" @click="bumpShopItem(entry, 1)">+</button>
            </div>
            <button class="cart-remove" type="button" aria-label="Убрать" @click="removeShopItem(entry)">
              <X :size="14" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div class="cart-footer">
          <span>Итого <strong>{{ shopSpentLabel }}</strong></span>
          <span>Остаток <strong>{{ shopRemainingLabel }}</strong></span>
        </div>
      </aside>
    </div>

    <ItemViewModal
      v-if="viewItem"
      :item="viewItem"
      :item-id="viewItem.item_id ?? viewItem.id"
      :item-type-id="viewItem.typeId"
      @close="viewItem = null"
    />
    <ConfirmDialog
      v-if="rerollConfirmOpen"
      title="Перебросить начальное богатство?"
      message="Текущая корзина очистится, и бюджет будет рассчитан заново."
      confirm-label="Перебросить"
      @cancel="rerollConfirmOpen = false"
      @confirm="confirmReroll"
    />
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import { Dices, Plus, Search, ShoppingBasket, X } from '@lucide/vue'
import { ConfirmDialog } from '@sylvieshare/share-ui'
import ItemReferenceRow from '@/features/items/components/ItemReferenceRow.vue'
import ItemViewModal from '@/features/handbook/components/ItemViewModal.vue'
import { formatCopper, itemCostCopper } from '@/features/character-editor/settings/dnd/creation/startingShop'

const {
  state, shopLoading, startingShopItems, startingWealthFormulaLabel,
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
]
const activeType = ref(2)
const query = ref('')
const viewItem = ref(null)
const rerollConfirmOpen = ref(false)
const categories = computed(() => TYPE_LABELS.map((category) => ({
  ...category,
  count: startingShopItems.value.filter((item) => Number(item.typeId) === category.id).length,
})))
const visibleItems = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase('ru')
  return startingShopItems.value.filter((item) => Number(item.typeId) === activeType.value
    && (!needle || `${item.name} ${item.nameEn || ''}`.toLocaleLowerCase('ru').includes(needle)))
})
const cartCount = computed(() => state.startingShopCart.reduce((sum, entry) => sum + Math.max(1, Number(entry.count) || 1), 0))
const cartCountLabel = computed(() => cartCount.value ? `${cartCount.value} шт.` : 'Пока пусто')
const priceLabel = (item) => formatCopper(itemCostCopper(item))
const instanceName = (entry) => entry.params?.length_ft != null ? `${entry.name} · ${entry.params.length_ft} фт.` : entry.name

function requestReroll() {
  if (state.startingShopCart.length) rerollConfirmOpen.value = true
  else rerollStartingWealth()
}
function confirmReroll() { rerollConfirmOpen.value = false; rerollStartingWealth() }
</script>

<style scoped>
.shop-step { display: flex; flex-direction: column; gap: 14px; }
.wealth-card { display: grid; grid-template-columns: 1fr auto; gap: 12px 18px; padding: 16px 18px; border: 1px solid color-mix(in srgb, var(--warning) 38%, var(--border)); border-radius: calc(var(--r-md) + 3px); background: radial-gradient(circle at 8% 0%, color-mix(in srgb, var(--warning) 15%, transparent), transparent 38%), var(--surface); }
.wealth-copy { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px 14px; }
.wealth-kicker { width: 100%; color: var(--warning); font-size: 10px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; }
.wealth-copy strong { color: var(--text-1); font-family: var(--font-display); font-size: 30px; }
.wealth-rolls { display: flex; align-items: center; gap: 5px; }
.wealth-rolls span { min-width: 25px; padding: 4px 6px; border: 1px solid color-mix(in srgb, var(--warning) 34%, var(--border)); border-radius: 7px; color: var(--text-1); background: var(--bg); font-size: 12px; font-weight: 800; text-align: center; }
.wealth-rolls small { color: var(--text-muted); font-size: 11px; }
.reroll { align-self: center; display: inline-flex; align-items: center; gap: 7px; padding: 8px 11px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface-raised); color: var(--text-1); font: inherit; font-size: 12px; font-weight: 650; cursor: pointer; }
.reroll:hover { border-color: var(--warning); color: var(--warning); }
.wealth-totals { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.wealth-totals span { display: flex; flex-direction: column; gap: 2px; padding: 9px 11px; border-radius: var(--r-sm); background: color-mix(in srgb, var(--bg) 80%, transparent); color: var(--text-1); font-size: 14px; font-weight: 750; }
.wealth-totals small { color: var(--text-muted); font-size: 9px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
.wealth-totals .remaining { color: var(--success); }
.shop-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 34%); align-items: start; gap: 12px; }
.shop-catalogue, .cart { min-width: 0; border: 1px solid var(--border); border-radius: calc(var(--r-md) + 2px); background: color-mix(in srgb, var(--surface) 72%, transparent); }
.shop-toolbar { position: sticky; top: 0; z-index: 2; display: flex; flex-direction: column; gap: 8px; padding: 11px; border-bottom: 1px solid var(--border); border-radius: inherit; background: color-mix(in srgb, var(--surface-raised) 94%, transparent); }
.shop-search { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid var(--border); border-radius: var(--r-md); color: var(--text-muted); background: var(--bg); }
.shop-search input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--text-1); font: inherit; font-size: 12px; }
.shop-tabs { display: flex; gap: 5px; overflow-x: auto; }
.shop-tabs button { flex: none; padding: 6px 9px; border: 0; border-radius: 999px; background: var(--surface); color: var(--text-2); font: inherit; font-size: 10px; cursor: pointer; }
.shop-tabs button.active { background: var(--accent); color: var(--text-on-accent); font-weight: 750; }
.shop-tabs small { opacity: .72; }
.shop-items { display: flex; flex-direction: column; gap: 7px; max-height: 570px; padding: 9px; overflow-y: auto; }
.shop-item { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px; }
.shop-add { display: flex; align-items: center; justify-content: center; gap: 5px; min-width: 84px; padding: 0 9px; border: 1px solid color-mix(in srgb, var(--success) 38%, var(--border)); border-radius: var(--r-md); background: color-mix(in srgb, var(--success) 10%, var(--surface)); color: var(--success); font: inherit; font-size: 10px; font-weight: 750; cursor: pointer; white-space: nowrap; }
.shop-add:hover:not(:disabled) { background: color-mix(in srgb, var(--success) 18%, var(--surface)); }
.shop-add:disabled { opacity: .35; cursor: not-allowed; }
.shop-empty { padding: 36px 16px; color: var(--text-muted); font-size: 12px; text-align: center; }
.cart { position: sticky; top: 12px; overflow: hidden; }
.cart-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 13px 14px; border-bottom: 1px solid var(--border); color: var(--accent); }
.cart-heading > div { display: flex; flex-direction: column; gap: 2px; }
.cart-heading span { color: var(--text-1); font-family: var(--font-display); font-size: 18px; font-weight: 700; }
.cart-heading small { color: var(--text-muted); font-size: 10px; }
.cart-empty { padding: 28px 16px; color: var(--text-muted); font-size: 12px; line-height: 1.5; text-align: center; }
.cart-items { display: flex; flex-direction: column; max-height: 470px; overflow-y: auto; }
.cart-item { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 4px 8px; padding: 10px 12px; }
.cart-item + .cart-item { border-top: 1px solid var(--border); }
.cart-name { min-width: 0; padding: 0; border: 0; background: none; color: var(--text-1); font: inherit; font-size: 12px; font-weight: 650; text-align: left; cursor: pointer; }
.cart-name:hover { color: var(--accent); }
.cart-price { color: var(--warning); font-size: 10px; font-weight: 700; white-space: nowrap; }
.cart-quantity { grid-column: 1 / 3; display: flex; align-items: center; gap: 5px; }
.cart-quantity button, .cart-remove { width: 23px; height: 23px; display: grid; place-items: center; padding: 0; border: 1px solid var(--border); border-radius: 6px; background: var(--surface-raised); color: var(--text-1); cursor: pointer; }
.cart-quantity button:disabled { opacity: .35; cursor: not-allowed; }
.cart-quantity strong { min-width: 24px; color: var(--text-1); font-size: 11px; text-align: center; }
.cart-remove { grid-row: 1 / 3; grid-column: 3; border: 0; background: transparent; color: var(--text-muted); }
.cart-remove:hover { color: var(--danger); background: color-mix(in srgb, var(--danger) 10%, transparent); }
.cart-footer { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 11px 12px; border-top: 1px solid var(--border); background: var(--surface-raised); }
.cart-footer span { display: flex; flex-direction: column; gap: 2px; color: var(--text-muted); font-size: 9px; text-transform: uppercase; }
.cart-footer strong { color: var(--text-1); font-size: 12px; text-transform: none; }
@media (max-width: 820px) { .shop-layout { grid-template-columns: 1fr; } .cart { position: static; order: -1; } .cart-items, .shop-items { max-height: none; } }
@media (max-width: 540px) { .wealth-card { grid-template-columns: 1fr; } .reroll { justify-self: start; } .wealth-totals { grid-column: 1; grid-template-columns: 1fr; } .shop-item { grid-template-columns: minmax(0, 1fr); } .shop-add { min-height: 34px; } }
</style>
