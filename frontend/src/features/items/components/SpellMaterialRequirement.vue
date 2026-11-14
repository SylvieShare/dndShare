<template>
  <BaseTile v-if="requirement" :outlined="false" :tint="!!requirement.priceLabel" color="var(--warning)" class="spell-material-requirement" :class="{ 'spell-material-requirement--priced': !!requirement.priceLabel }" role="note"
    :style="{ '--tile-surface': 'color-mix(in srgb,var(--bg) 85%,transparent)' }" :title="requirement.description" :aria-label="'Материальный компонент: ' + requirement.description">
    <span class="spell-material-marker" aria-hidden="true"><component :is="spellComponentIcons.m" :size="layoutTokens['spell-component-icon-size']" /><strong>М</strong></span>
    <span class="spell-material-name">{{ requirement.name }}</span>
    <strong v-if="requirement.priceLabel" class="spell-material-price"><Coins :size="14" aria-hidden="true" />{{ requirement.priceLabel }}</strong>
  </BaseTile>
</template>
<script setup>
import {computed} from 'vue'
import {BaseTile} from '@sylvieshare/share-ui'
import {Coins} from '@lucide/vue'
import {spellMaterialRequirement} from '@/features/items/lib/spellMaterialRequirement'
import {spellComponentIcons} from '@/features/items/lib/spellComponentIcons'
import {layoutTokens} from '@/app/design-tokens'
const props=defineProps({components:Object})
const requirement=computed(()=>spellMaterialRequirement(props.components))
</script>
<style scoped>
.spell-material-requirement {display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:start;gap:var(--spacing-compact);width:100%;max-width:100%;padding:var(--spacing-compact) var(--spacing-small);color:var(--text-1);font-family:var(--type-context-family);font-size:var(--type-context-size);line-height:var(--type-context-line-height);text-align:left;overflow-wrap:anywhere}
.spell-material-requirement--priced {color:var(--warning)}
.spell-material-marker {display:inline-flex;align-items:center;gap:calc(var(--spacing-xs) / 2)}
.spell-material-marker svg {flex:none}
.spell-material-name::first-letter {text-transform:uppercase}
.spell-material-price {display:inline-flex;align-items:center;gap:var(--spacing-xs);max-width:var(--layout-spell-material-width);color:inherit;font-size:var(--type-group-size);line-height:var(--type-group-line-height);font-weight:700;white-space:normal}
.spell-material-price svg {flex:none}
@media (--ui-phone){.spell-material-price{grid-column:2 / -1}}
</style>
