<template>
  <ActionButton ref="trigger" variant="quiet" class="money-currency" :class="{ 'money-currency--open': open }"
    role="combobox" aria-label="Валюта калькулятора" aria-haspopup="listbox" :aria-expanded="open"
    :aria-controls="listId" :aria-activedescendant="open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined"
    :disabled="!coins.length" @click="open = !open" @keydown="keydown">
    <template #icon>
      <ItemIcon v-if="selected?.iconImageUrl || selected?.svg" :item="selected" :size="24" :fallback-to-type="false" />
      <span v-else-if="selected" class="money-currency__dot" :style="{ background: selected.color }" />
    </template>
    <span class="money-currency__identity"><span class="money-currency__name">{{ selected?.title || '—' }}</span><ChevronDown :size="12" aria-hidden="true" /></span>
  </ActionButton>
  <BasePopover :open="open" :anchor="trigger?.$el" placement="bottom-end" :min-width="170" :z-index="3200" @update:open="open = $event">
    <OptionList :id="listId" :options="options" :active-index="activeIndex" label="Монеты" @active="activeIndex = $event" @select="pick">
      <template #option="{ option }">
        <ItemIcon v-if="option.item.iconImageUrl || option.item.svg" :item="option.item" :size="24" :fallback-to-type="false" />
        <span v-else class="money-currency__dot" :style="{ background: option.item.color }" />
        <span>{{ option.label }}</span>
      </template>
    </OptionList>
  </BasePopover>
</template>

<script setup>
import { computed, nextTick, ref, useId, watch } from 'vue'
import { ActionButton, BasePopover, OptionList } from '@sylvieshare/share-ui'
import { ChevronDown } from '@lucide/vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'

const props = defineProps({ modelValue: { type: String, default: '' }, coins: { type: Array, default: () => [] } })
const emit = defineEmits(['update:modelValue'])
const trigger = ref(null)
const open = ref(false)
const activeIndex = ref(-1)
const listId = useId()
const selected = computed(() => props.coins.find(coin => String(coin.id) === props.modelValue))
const options = computed(() => props.coins.map(item => ({ value: String(item.id), label: item.title, item })))

watch(open, value => { if (value) activeIndex.value = Math.max(0, options.value.findIndex(option => option.value === props.modelValue)) })

function pick(option) {
  if (!option) return
  emit('update:modelValue', option.value)
  open.value = false
  nextTick(() => trigger.value?.$el?.focus())
}

function keydown(event) {
  if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
    event.preventDefault()
    if (!open.value) open.value = true
    else if (options.value.length) activeIndex.value = (activeIndex.value + (event.key === 'ArrowDown' ? 1 : -1) + options.value.length) % options.value.length
  } else if (open.value && ['Enter', ' '].includes(event.key)) {
    event.preventDefault()
    pick(options.value[activeIndex.value])
  } else if (open.value && event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    open.value = false
  }
}
</script>

<style scoped>
.money-currency { max-width: 108px; min-height: 36px; padding: 4px 6px; gap: 5px; flex: none; }
.money-currency--open { background: var(--surface-active); }
.money-currency__identity { display: inline-flex; align-items: center; gap: 5px; min-width: 0; }
.money-currency__name { max-width: 46px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.money-currency__identity svg { flex: none; color: var(--text-muted); transition: transform .16s; }
.money-currency--open .money-currency__identity svg { transform: rotate(180deg); }
.money-currency__dot { width: 12px; height: 12px; border-radius: 50%; flex: none; }
@media (prefers-reduced-motion: reduce) { .money-currency__identity svg { transition: none; } }
</style>
