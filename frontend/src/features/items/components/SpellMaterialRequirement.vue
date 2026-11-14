<template>
  <BaseTile v-if="requirement" :outlined="false" class="spell-material-requirement" role="note"
    :style="{ '--tile-surface': 'color-mix(in srgb,var(--bg) 85%,transparent)' }" :title="requirement.description" :aria-label="'Материальный компонент: ' + requirement.description">
    <span class="spell-material-name">{{ requirement.name }}</span>
    <strong class="spell-material-price"><Coins :size="14" aria-hidden="true" />{{ requirement.priceLabel }}</strong>
  </BaseTile>
</template>
<script setup>
import {computed} from 'vue'
import {BaseTile} from '@sylvieshare/share-ui'
import {Coins} from '@lucide/vue'
import {spellMaterialRequirement} from '@/features/items/lib/spellMaterialRequirement'
const props=defineProps({components:Object})
const requirement=computed(()=>spellMaterialRequirement(props.components))
</script>
<style scoped>
.spell-material-requirement {display:flex;flex-direction:column;align-items:flex-start;gap:var(--spacing-xs);width:var(--spell-material-width,var(--layout-spell-material-width));max-width:100%;padding:var(--spacing-compact) var(--spacing-small);color:var(--text-1);font-family:var(--type-context-family);font-size:var(--type-context-size);line-height:var(--type-context-line-height);text-align:left;overflow-wrap:anywhere}
.spell-material-name::first-letter {text-transform:uppercase}
.spell-material-price {display:inline-flex;align-items:center;gap:var(--spacing-xs);color:var(--warning);font-size:var(--type-group-size);line-height:var(--type-group-line-height);font-weight:700;white-space:normal}
.spell-material-price svg {flex:none}
</style>
