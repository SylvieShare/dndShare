<template>
  <div class="wizard-shop">
    <h2 class="sheet-section-title">Магазин</h2>
    <div class="shop-columns">
      <section class="catalogue" aria-label="Каталог магазина">
        <FormTextInput v-model:value="query" placeholder="Найти предмет…" aria-label="Поиск предмета" />
        <div class="categories" role="group" aria-label="Категории магазина">
          <button v-for="group in groups" :key="group.id" type="button"
            :aria-pressed="group.id === current?.id" @click="selected = group.id">
            <ItemIcon v-if="group.type?.iconImageUrl || group.type?.svg || group.type?.iconSvgId" :type="group.type" :size="24" />
            <BookOpen v-else :size="24" aria-hidden="true" />
            {{ group.label }} <small>{{ group.rows.length }}</small>
          </button>
        </div>
        <LoadingState v-if="loading" label="Загружаем каталог…" compact />
        <div v-else-if="current" class="shop-rows">
          <slot v-for="item in current.rows" name="item" :key="item[itemKey]" :item="item" />
        </div>
        <p v-else>Предметы не найдены.</p>
      </section>
      <div class="shop-summary">
        <section class="wealth-card"><slot name="budget" /></section>
        <aside class="cart">
          <div class="cart-heading">
            <div><span>Корзина</span><small>{{ cartCount ? cartCount + ' шт.' : 'Пока пусто' }}</small></div>
            <ShoppingBasket :size="20" aria-hidden="true" />
          </div>
          <div v-if="cartCount" class="cart-items"><slot name="cart" /></div>
          <div v-else class="cart-empty">Добавляйте предметы из каталога. Покупки сразу считаются в бюджете.</div>
          <div v-if="$slots.totals" class="cart-footer"><slot name="totals" /></div>
        </aside>
        <slot name="extras" />
      </div>
    </div>
  </div>
</template>
<script setup>
import { computed, ref } from 'vue'
import { FormTextInput, LoadingState } from '@sylvieshare/share-ui'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import { BookOpen, ShoppingBasket } from '@lucide/vue'

const props = defineProps({
  items: { type: Array, required: true },
  categories: { type: Array, required: true },
  categoryOf: { type: Function, required: true },
  itemKey: { type: String, default: 'id' },
  loading: Boolean,
  cartCount: { type: Number, required: true },
})
const query = ref('')
const selected = ref(null)
const groups = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase('ru')
  const buckets = new Map()
  for (const item of props.items) {
    if (!((item.name || '') + ' ' + (item.nameEn || '')).toLocaleLowerCase('ru').includes(needle)) continue
    const key = props.categoryOf(item)
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(item)
  }
  return props.categories.filter(group => buckets.has(group.id))
    .map(group => ({ ...group, rows: buckets.get(group.id) }))
})
const current = computed(() => groups.value.find(group => group.id === selected.value) || groups.value[0])
</script>
<style scoped>
.wizard-shop > h2 { margin: 0; }
.wizard-shop { min-width: 0; container-type: inline-size; display: grid; gap: var(--spacing-medium); }
.shop-columns { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(250px, 1fr); gap: var(--spacing-medium); align-items: start; }
.catalogue, .shop-summary { display: grid; min-width: 0; gap: var(--spacing-medium); }
.categories { display: flex; flex-wrap: wrap; gap: 4px; }
.categories button { display: inline-flex; align-items: center; gap: 4px; padding: 6px 8px; background: var(--surface); color: var(--text-2); border: 0; border-radius: var(--r-md); font: inherit; font-size: 12px; cursor: pointer; }
.categories button[aria-pressed=true] { background: var(--accent); color: var(--text-on-accent); }
.shop-rows { display: grid; gap: var(--spacing-small); max-height: 66dvh; overflow-y: auto; }
@container (max-width: 620px) {
  .shop-columns { grid-template-columns: minmax(0, 1fr); }
  .shop-rows { max-height: 48dvh; }
}
</style>

<style>
.wizard-shop .wealth-card { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px 18px; padding: 16px 18px; border: 1px solid color-mix(in srgb, var(--warning) 38%, var(--border)); border-radius: calc(var(--r-md) + 3px); background: radial-gradient(circle at 8% 0%, color-mix(in srgb, var(--warning) 15%, transparent), transparent 38%), var(--surface); }
.wizard-shop .wealth-copy { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px 14px; }
.wizard-shop .wealth-kicker { width: 100%; color: var(--warning); font-size: 10px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; }
.wizard-shop .wealth-copy strong { color: var(--text-1); font-family: var(--font-display); font-size: 30px; }
.wizard-shop .wealth-totals { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.wizard-shop .wealth-totals > span { display: flex; flex-direction: column; gap: 2px; padding: 9px 11px; border-radius: var(--r-sm); background: color-mix(in srgb, var(--bg) 80%, transparent); color: var(--text-1); font-size: 14px; font-weight: 750; }
.wizard-shop .wealth-totals small { color: var(--text-muted); font-size: 9px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
.wizard-shop .wealth-totals .remaining { color: var(--success); }
.wizard-shop .cart { min-width: 0; border: 1px solid var(--border); border-radius: calc(var(--r-md) + 2px); background: color-mix(in srgb, var(--surface) 72%, transparent); }
.wizard-shop .shop-item { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px; }
.wizard-shop .shop-add { display: flex; align-items: center; justify-content: center; gap: 5px; min-width: 84px; padding: 0 9px; border: 1px solid color-mix(in srgb, var(--success) 38%, var(--border)); border-radius: var(--r-md); background: color-mix(in srgb, var(--success) 10%, var(--surface)); color: var(--success); font: inherit; font-size: 10px; font-weight: 750; cursor: pointer; white-space: nowrap; }
.wizard-shop .shop-add:hover:not(:disabled) { background: color-mix(in srgb, var(--success) 18%, var(--surface)); }
.wizard-shop .shop-add:disabled { opacity: .35; cursor: not-allowed; }
.wizard-shop .cart-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 13px 14px; border-bottom: 1px solid var(--border); color: var(--accent); }
.wizard-shop .cart-heading > div { display: flex; flex-direction: column; gap: 2px; }
.wizard-shop .cart-heading span { color: var(--text-1); font-family: var(--font-display); font-size: 18px; font-weight: 700; }
.wizard-shop .cart-heading small { color: var(--text-muted); font-size: 10px; }
.wizard-shop .cart-empty { padding: 28px 16px; color: var(--text-muted); font-size: 12px; line-height: 1.5; text-align: center; }
.wizard-shop .cart-items { display: flex; flex-direction: column; max-height: 470px; overflow-y: auto; }
.wizard-shop .cart-item { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 4px 8px; padding: 10px 12px; }
.wizard-shop .cart-item + .cart-item { border-top: 1px solid var(--border); }
.wizard-shop .cart-name { display: flex; align-items: center; gap: 6px; min-width: 0; padding: 0; border: 0; background: none; color: var(--text-1); font: inherit; font-size: 12px; font-weight: 650; text-align: left; cursor: pointer; }
.wizard-shop .cart-name:hover { color: var(--accent); }
.wizard-shop .cart-price { color: var(--warning); font-size: 10px; font-weight: 700; white-space: nowrap; }
.wizard-shop .cart-quantity { grid-column: 1 / 3; display: flex; align-items: center; gap: 5px; }
.wizard-shop .cart-quantity button, .wizard-shop .cart-remove { width: 23px; height: 23px; display: grid; place-items: center; padding: 0; border: 1px solid var(--border); border-radius: 6px; background: var(--surface-raised); color: var(--text-1); cursor: pointer; }
.wizard-shop .cart-quantity button:disabled { opacity: .35; cursor: not-allowed; }
.wizard-shop .cart-quantity strong { min-width: 24px; color: var(--text-1); font-size: 11px; text-align: center; }
.wizard-shop .cart-remove { grid-row: 1 / 3; grid-column: 3; border: 0; background: transparent; color: var(--text-muted); }
.wizard-shop .cart-remove:hover { color: var(--danger); background: color-mix(in srgb, var(--danger) 10%, transparent); }
.wizard-shop .cart-footer { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 11px 12px; border-top: 1px solid var(--border); background: var(--surface-raised); }
.wizard-shop .cart-footer > span { display: flex; flex-direction: column; gap: 2px; color: var(--text-muted); font-size: 9px; text-transform: uppercase; }
.wizard-shop .cart-footer strong { color: var(--text-1); font-size: 12px; text-transform: none; }
.wizard-shop .cart-options { grid-column: 1 / -1; display: grid; gap: var(--spacing-small); min-width: 0; }
.wizard-shop .cart-options > *, .wizard-shop .shop-summary > *, .wizard-shop .shop-rows > * { min-width: 0; max-width: 100%; }
.wizard-shop .cart-name { overflow-wrap: anywhere; }
.wizard-shop .wealth-totals strong { color: inherit; }
@media (max-width: 540px) {
  .wizard-shop .shop-item { grid-template-columns: minmax(0, 1fr); }
  .wizard-shop .shop-add { min-height: 34px; }
}
</style>
