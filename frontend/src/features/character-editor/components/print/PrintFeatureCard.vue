<template>
  <article class="feature-card" :class="{ 'feature-card--wide': feature.span === 2 }">
    <div class="feature-kind">{{ feature.group }}</div>
    <header>
      <h3>{{ feature.name }}</h3>
      <strong v-if="feature.countText">{{ feature.countText }}</strong>
    </header>
    <RichContent v-if="feature.description" class="feature-description" :html="feature.description" />
    <p v-else class="feature-empty">Описание отсутствует.</p>
  </article>
</template>

<script setup>
import { RichContent } from '@sylvieshare/share-ui'

defineProps({ feature: { type: Object, required: true } })
</script>

<style scoped>
.feature-card { position: relative; min-width: 0; padding: 4mm; border: 1px solid #695a44; background: #fffefa; box-shadow: inset 0 0 0 .8mm #fffefa, inset 0 0 0 1mm #c8baa0; break-inside: avoid; align-self: start; }
.feature-card--wide { grid-column: 1 / -1; }
.feature-kind { margin-bottom: 1.5mm; font: 700 5.5px/1 Arial, sans-serif; letter-spacing: .11em; text-transform: uppercase; color: #8a7a61; }
.feature-card header { display: flex; align-items: baseline; justify-content: space-between; gap: 3mm; padding-bottom: 2mm; border-bottom: .5px solid #b9ab93; }
.feature-card h3 { min-width: 0; margin: 0; font: 700 14px/1.2 Georgia, serif; overflow-wrap: anywhere; }
.feature-card header strong { flex: 0 0 auto; font: 700 7px/1 Arial, sans-serif; }
.feature-description { margin-top: 2.5mm; color: #332e27; font: 8px/1.5 Georgia, serif; }
.feature-description :deep(h1), .feature-description :deep(h2), .feature-description :deep(h3), .feature-description :deep(h4) { color: #332e27; font-size: 9px; margin: 2mm 0 1mm; }
.feature-description :deep(ul), .feature-description :deep(ol) { margin: 1.5mm 0 2mm 4.5mm; }
.feature-empty { margin: 2.5mm 0 0; color: #81725b; font: italic 8px Georgia, serif; }
</style>
