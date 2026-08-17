<template>
  <RichContent v-bind="$attrs" :html="html">
    <template #node="{ node }">
      <DndRichInlineNode :node="node" />
    </template>
  </RichContent>
</template>

<script setup>
import { RichContent } from '@sylvieshare/share-ui'
import DndRichInlineNode from '@/shared/ui/DndRichInlineNode.vue'

defineOptions({ inheritAttrs: false })
defineProps({ html: { type: String, default: '' } })
</script>
