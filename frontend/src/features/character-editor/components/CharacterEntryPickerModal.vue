<template>
  <AppModalFrame :title="title" :subtitle="subtitle" :z-index="4600" @close="$emit('close')">
    <div v-if="entries.length" class="cep-list">
      <button
        v-for="entry in entries"
        :key="entry.key"
        class="cep-entry"
        type="button"
        :disabled="entry.disabled"
        @click="$emit('select', entry.value)"
      >
        <span class="cep-icon" aria-hidden="true">
          <ItemIcon v-if="entry.item" :item="entry.item" :size="46" :fallback-to-type="false" />
          <CircleDot v-else :size="22" :stroke-width="1.8" />
        </span>
        <span class="cep-copy">
          <strong>{{ entry.title }}</strong>
          <span v-if="entry.subtitle">{{ entry.subtitle }}</span>
          <small v-if="entry.note">{{ entry.note }}</small>
        </span>
      </button>
    </div>
    <p v-else class="cep-empty">{{ emptyText }}</p>
  </AppModalFrame>
</template>

<script setup>
import { CircleDot } from '@lucide/vue'
import { AppModalFrame } from '@sylvieshare/share-ui'
import ItemIcon from '@/features/items/components/ItemIcon.vue'

defineProps({
  title: { type: String, default: 'Выбор' },
  subtitle: { type: String, default: '' },
  entries: { type: Array, default: () => [] },
  emptyText: { type: String, default: 'Нет доступных вариантов.' },
})

defineEmits(['close', 'select'])
</script>

<style scoped>
.cep-list { display: flex; flex-direction: column; gap: 8px; min-width: min(420px, 78vw); }
.cep-entry { display: grid; grid-template-columns: 48px minmax(0, 1fr); gap: 11px; align-items: center; width: 100%; min-height: 62px; padding: 7px 10px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-raised); color: var(--text-1); cursor: pointer; font: inherit; text-align: left; transition: border-color .14s, background .14s; }
.cep-entry:hover:not(:disabled) { border-color: color-mix(in srgb, var(--accent) 55%, var(--border)); background: color-mix(in srgb, var(--accent) 7%, var(--surface-raised)); }
.cep-entry:disabled { cursor: default; opacity: .55; }
.cep-icon { display: grid; width: 46px; height: 46px; place-items: center; overflow: hidden; color: var(--text-muted); }
.cep-copy { display: flex; min-width: 0; flex-direction: column; gap: 2px; }
.cep-copy strong { overflow: hidden; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.cep-copy span { color: var(--text-2); font-size: 11px; }
.cep-copy small { color: var(--accent-soft); font-size: 10px; }
.cep-empty { margin: 8px 0 18px; color: var(--text-muted); font-size: 13px; }
</style>
