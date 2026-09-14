<template>
  <ContentRow :title="item.name" :alternate-label="nameEnFormatted" :marker="custom ? '✦' : ''" marker-label="Ваш объект" :subtitle="subtitle" :name-center="nameCenter" :show-chevron="showChevron" :interactive="interactive" :selected="selected" @activate="$emit('activate', $event)">
    <template #icon>
      <slot name="icon">
        <ItemIcon v-if="hasResolvedIcon" :item="item" :type="type" :fallback-to-type="iconFallbackToType" :size="resolvedIconSize" />
        <slot v-else name="icon-fallback" />
      </slot>
    </template>
    <template v-if="$slots.metric" #metric><slot name="metric" /></template>
    <template v-if="$slots.subtitle" #subtitle><slot name="subtitle" /></template>
    <template v-if="$slots['name-extras']" #name-extras><slot name="name-extras" /></template>
    <template v-if="$slots.trailing" #trailing><slot name="trailing" /></template>
  </ContentRow>
</template>

<script setup>
import { computed } from 'vue'
import { ContentRow } from '@sylvieshare/share-ui'
import ItemIcon from '@/features/items/components/ItemIcon.vue'

// Shared row shell for handbook object lists. The stable order is icon, optional
// metric, two-line identity, then trailing metadata and the disclosure chevron.
const props = defineProps({
  item: { type: Object, required: true },
  interactive: { type: Boolean, default: false },
  selected: { type: Boolean, default: false },
  type: { type: Object, default: null },
  nameEn: { type: String, default: '' },
  custom: { type: Boolean, default: false },
  subtitle: { type: String, default: '' },
  nameCenter: { type: Boolean, default: false },
  showChevron: { type: Boolean, default: true },
  iconFallbackToType: { type: Boolean, default: true },
})

defineEmits(['activate'])

const hasResolvedIcon = computed(() => !!(
  props.item?.iconImageUrl
  || props.item?.svg
  || (props.iconFallbackToType && props.type?.iconImageUrl)
))
const resolvedIconSize = computed(() => (
  props.item?.iconImageUrl || (!props.item?.svg && props.iconFallbackToType && props.type?.iconImageUrl)
) ? 64 : 22)

const nameEnFormatted = computed(() =>
  (props.nameEn || '')
    .replace(/_/g, ' ')
    .replace(/\b[a-z]/g, ch => ch.toUpperCase())
)
</script>
