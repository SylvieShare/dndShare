<template>
  <BasePopover :open="open" :anchor="anchor" placement="bottom-end" :min-width="0" :z-index="4000"
    :close-on-resize="false" :close-on-scroll="false" transition-preset="action-menu" aria-label="Меню персонажа"
    @update:open="$emit('update:open', $event)">
    <div ref="content" class="character-menu-content"><slot /></div>
  </BasePopover>
</template>
<script setup>
import { nextTick, ref, watch } from 'vue'
import { BasePopover } from '@sylvieshare/share-ui'
const props = defineProps({ open: Boolean, anchor: { type: Object, default: null } })
defineEmits(['update:open'])
const content = ref(null)
watch(() => props.open, async value => {
  if (value) { await nextTick(); content.value?.querySelector('button:not(:disabled)')?.focus() }
  else if (content.value?.contains(document.activeElement)) {
    const trigger = props.anchor?.matches('button, [role=button]') ? props.anchor : props.anchor?.querySelector('button, [role=button]')
    trigger?.focus()
  }
})
</script>
<style scoped>
.character-menu-content { width: min(260px, calc(100vw - 30px)); max-height: calc(100dvh - 30px); overflow: auto; overscroll-behavior: contain; }
</style>
