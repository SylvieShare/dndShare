<template>
  <div class="wizard-shop">
    <div class="shop-columns">
      <section class="catalogue" aria-label="Каталог магазина">
        <FormTextInput v-model:value="query" placeholder="Найти предмет…" aria-label="Поиск предмета" />
        <div class="categories" role="group" aria-label="Категории магазина">
          <button v-for="group in groups" :key="group.id" type="button"
            :aria-pressed="group.id === current?.id" @click="selected = group.id">
            <component :is="group.icon || Package" :size="16" aria-hidden="true" />
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
        <slot name="budget" />
        <slot name="cart" />
      </div>
    </div>
    <slot name="extras" />
  </div>
</template>
<script setup>
import { computed, ref } from 'vue'
import { FormTextInput, LoadingState } from '@sylvieshare/share-ui'
import { Package } from '@lucide/vue'

const props = defineProps({
  items: { type: Array, required: true },
  categories: { type: Array, required: true },
  categoryOf: { type: Function, required: true },
  itemKey: { type: String, default: 'id' },
  loading: Boolean,
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
.wizard-shop { container-type: inline-size; display: grid; gap: var(--spacing-medium); }
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
