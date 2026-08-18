<template>
  <RichContent class="dnd-rich-content" v-bind="$attrs" :html="html">
    <template #node="{ node }">
      <DndRichInlineNode :node="node" :actor-name="actorName" />
    </template>
  </RichContent>
</template>

<script setup>
import { RichContent } from '@sylvieshare/share-ui'
import DndRichInlineNode from '@/shared/ui/DndRichInlineNode.vue'

defineOptions({ inheritAttrs: false })
defineProps({
  html: { type: String, default: '' },
  actorName: { type: String, default: '' },
})
</script>
