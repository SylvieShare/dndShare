<template>
  <section class="global-map-links" :aria-label="title">
    <SectionLabel line>{{ title }}<template #actions><span>{{ selectedIds.length }}</span></template></SectionLabel>
    <TransitionGroup name="point-link" tag="div" class="global-map-link-list">
      <BaseTile v-for="item in selected" :key="item.id" framed class="global-map-link-row">
        <ActionButton variant="quiet" class="global-map-link-open" :aria-label="`Открыть: ${item.name}`" @click="emit('open', item)">
          <GlobalMapLinkPreview :item="item" :kind="kind" />
        </ActionButton>
        <RemoveButton icon="trash" :label="`Удалить связь: ${item.name}`" :disabled="disabled" @click="emit('update', selectedIds.filter(id => id !== item.id))" />
      </BaseTile>
    </TransitionGroup>
    <AddButton block :label="addLabel" :disabled="disabled || selectedIds.length >= 64" :aria-expanded="open" @click="toggle">Добавить</AddButton>
    <BasePopover v-model:open="open" :anchor="anchor" :min-width="260" :z-index="2400" role="dialog" :aria-label="addLabel" transition-preset="action-menu">
      <div class="global-map-link-picker">
        <FormTextInput v-model:value="query" :aria-label="`Поиск: ${title}`" placeholder="Найти по названию…" />
        <div class="global-map-link-options">
          <ActionButton v-for="item in filtered" :key="item.id" variant="quiet" class="global-map-link-option" :disabled="disabled || selectedIds.includes(item.id) || selectedIds.length >= 64" :aria-label="`Добавить: ${item.name}`" @click="emit('update', [...selectedIds, item.id])">
            <GlobalMapLinkPreview :item="item" :kind="kind" />
            <Check v-if="selectedIds.includes(item.id)" :size="16" class="global-map-link-check" />
            <Plus v-else :size="16" />
          </ActionButton>
          <p v-if="!filtered.length">{{ items.length ? 'Ничего не найдено' : emptyLabel }}</p>
        </div>
      </div>
    </BasePopover>
  </section>
</template>
<script setup>
import { computed, ref, shallowRef, watch } from 'vue'
import { ActionButton, AddButton, BasePopover, BaseTile, FormTextInput, RemoveButton, SectionLabel } from '@sylvieshare/share-ui'
import { Check, Plus } from '@lucide/vue'
import GlobalMapLinkPreview from './GlobalMapLinkPreview.vue'
import { linkedItems } from '../lib/pointLinks'
const props = defineProps({ title: String, kind: String, addLabel: String, emptyLabel: String, items: Array, selectedIds: Array, disabled: Boolean })
const emit = defineEmits(['update', 'open'])
const open = ref(false), anchor = shallowRef(null), query = ref('')
const selected = computed(() => linkedItems(props.items, props.selectedIds))
const filtered = computed(() => props.items.filter(item => `${item.number || ''} ${item.name}`.toLocaleLowerCase('ru').includes(query.value.trim().toLocaleLowerCase('ru'))))
function toggle(event) { anchor.value = event.currentTarget; query.value = ''; open.value = !open.value }
watch(() => props.disabled, disabled => { if (disabled) open.value = false })
</script>
<style scoped>
.global-map-links, .global-map-link-list { display: grid; gap: 8px; }
.global-map-link-row { display: flex; align-items: center; gap: 4px; padding: 3px 6px 3px 3px; }
.global-map-link-open, .global-map-link-option { flex: 1; min-width: 0; justify-content: flex-start; text-align: left; }
.global-map-link-picker { width: min(288px, calc(100vw - 32px)); display: grid; gap: 8px; padding: 10px; box-sizing: border-box; }
.global-map-link-options { max-height: min(320px, 50dvh); overflow-y: auto; display: grid; gap: 4px; }
.global-map-link-option { width: 100%; }
.global-map-link-open :deep(> span), .global-map-link-option :deep(> span) { display: flex; flex: 1; min-width: 0; align-items: center; gap: 8px; }
.global-map-link-option :deep(svg) { flex: none; }
.global-map-link-check { color: var(--accent-soft); }
.global-map-link-options p { color: var(--text-muted); font-size: 12px; padding: 8px; margin: 0; }
.point-link-enter-active, .point-link-leave-active, .point-link-move { transition: opacity .15s ease, transform .15s ease; }
.point-link-enter-from, .point-link-leave-to { opacity: 0; transform: translateY(-4px); }
@media (prefers-reduced-motion: reduce) { .point-link-enter-active, .point-link-leave-active, .point-link-move { transition: none; } }
</style>
