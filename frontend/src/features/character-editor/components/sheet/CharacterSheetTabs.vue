<template>
  <IconNavigation :items="items" :model-value="activeTab" :pill="pill" :size="layoutTokens['sheet-navigation-item']" :height="layoutTokens['sheet-navigation-height']" radius="var(--radius-input)" label="Раздел персонажа"
    data-tutorial="character-tabs" @select="emit('select', $event)">
    <template #icon="{ item }">
      <span class="character-tab-icon" :style="{ maskImage: `url(${item.svg})`, WebkitMaskImage: `url(${item.svg})` }" aria-hidden="true" />
    </template>
  </IconNavigation>
</template>
<script setup>
import { computed } from 'vue'
import { IconNavigation } from '@sylvieshare/share-ui'
import { layoutTokens } from '@/app/design-tokens'
const props = defineProps({ tabs: Array, activeTab: Number, pill: Boolean })
const emit = defineEmits(['select'])
const items = computed(() => (props.tabs || []).map((tab, index) => ({ key: index, label: tab.title, svg: tab.svg })))
</script>
<style scoped>
.character-tab-icon { display: block; width: var(--layout-sheet-navigation-icon); height: var(--layout-sheet-navigation-icon); background: currentColor; mask-size: contain; mask-position: center; mask-repeat: no-repeat; }
</style>
