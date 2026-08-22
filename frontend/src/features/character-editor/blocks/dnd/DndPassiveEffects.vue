<template>
  <BaseTile v-if="effects.length" class="dpe-tile">
    <div class="dpe">
      <SheetBlockTitle title="Особые свойства" />
      <div class="dpe-list">
        <article v-for="effect in effects" :key="effect.key" class="dpe-row" :class="`dpe-row--${effect.tone}`">
          <strong>{{ effect.title }}</strong>
          <span v-if="effect.description">{{ effect.description }}</span>
          <small>Источник: {{ effect.source_label }}</small>
        </article>
      </div>
    </div>
  </BaseTile>
</template>

<script setup>
import { computed, inject } from 'vue'
import { BaseTile } from '@sylvieshare/share-ui'
import SheetBlockTitle from '@/shared/ui/SheetBlockTitle.vue'

const charCtx = inject('charCtx', {})
const effects = computed(() => {
  const value = charCtx.characterPassiveEffects?.effects
  if (Array.isArray(value)) return value
  return Array.isArray(value?.value) ? value.value : []
})
</script>

<style scoped>
.dpe-tile { display: block; width: 100%; min-width: 0; }
.dpe { display: flex; flex-direction: column; gap: 9px; padding: 9px 10px 10px; }
.dpe-list { display: flex; flex-direction: column; gap: 7px; }
.dpe-row { display: flex; flex-direction: column; gap: 3px; padding: 8px 9px; border: 1px solid var(--border); border-left: 3px solid var(--info); border-radius: 8px; background: var(--surface-raised); }
.dpe-row--warning { border-left-color: var(--warning); }
.dpe-row--danger { border-left-color: var(--danger); }
.dpe-row--success { border-left-color: var(--success); }
.dpe-row strong { color: var(--text-1); font-size: 12px; }
.dpe-row span { color: var(--text-2); font-size: 11px; line-height: 1.35; }
.dpe-row small { color: var(--text-muted); font-size: 9px; }
</style>

