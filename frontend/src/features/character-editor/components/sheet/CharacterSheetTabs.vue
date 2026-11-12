<template>
  <IconNavigation :items="items" :model-value="tabs?.[activeTab]?.id ?? activeTab" pill :layout="layout" :size="format === 'phone' ? layoutTokens['sheet-navigation-compact'] : layoutTokens['sheet-navigation-item']"
    :height="layoutTokens[format === 'desktop' ? 'sheet-navigation-desktop-height' : 'sheet-navigation-height']"
    :icon-size="layoutTokens[format === 'desktop' ? 'sheet-navigation-desktop-icon' : 'sheet-navigation-icon']"
    :label-size="format === 'desktop' ? 'var(--type-header-size)' : format === 'tablet' ? 'var(--type-sheet-navigation-caption-size)' : null"
    :content-sized="format === 'tablet'" :style="{ '--icon-navigation-label-line-height': format === 'tablet' ? 'var(--type-sheet-navigation-caption-line-height)' : undefined }"
    :selected-size="layoutTokens['sheet-navigation-selected']" :selection="selection" :animate="animate"
    radius="var(--radius-input)" :label="format === 'phone' ? 'Вкладки персонажа' : 'Раздел персонажа'" :data-sheet-navigation="format"
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
const props = defineProps({ tabs: Array, activeTab: Number, format: { type: String, default: 'tablet' }, selection: Array, animate: { type: Boolean, default: true } })
const emit = defineEmits(['select'])
const layout = computed(() => ({ phone: 'compact', tablet: 'stacked', desktop: 'inline' })[props.format])
const items = computed(() => (props.tabs || []).map((tab, index) => ({ key: tab.id ?? index, label: tab.title, svg: tab.svg })))
</script>
<style scoped>
.character-tab-icon { display: block; width: 100%; height: 100%; background: currentColor; mask-size: contain; mask-position: center; mask-repeat: no-repeat; }
</style>
